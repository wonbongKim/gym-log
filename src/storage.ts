// LocalStorage 접근 레이어
// - 인메모리 캐시를 스냅샷의 source of truth로 사용(참조 안정성 → useSyncExternalStore 호환)
// - 키별 구독(pub/sub)으로 모든 컴포넌트 인스턴스가 같은 데이터를 공유
// - 다른 탭에서 바뀐 값은 'storage' 이벤트로 캐시를 갱신

import type {
  ExercisesStore,
  RoutinesStore,
  LogsStore,
  SessionStore,
  Settings,
  SettingsStore,
} from './types'

export const KEYS = {
  exercises: 'gymlog_exercises',
  routines: 'gymlog_routines',
  logs: 'gymlog_logs',
  session: 'gymlog_session',
  settings: 'gymlog_settings',
} as const

type Key = (typeof KEYS)[keyof typeof KEYS]

export const DEFAULT_SETTINGS: Settings = {
  restSeconds: 90,
  restSound: true,
  keepAwake: true,
  lastBackupAt: null,
}

const DEFAULTS = {
  [KEYS.exercises]: { version: 1, exercises: [] } as ExercisesStore,
  [KEYS.routines]: { version: 1, routines: [] } as RoutinesStore,
  [KEYS.logs]: { version: 1, logs: [] } as LogsStore,
  [KEYS.session]: { version: 1, session: null } as SessionStore,
  [KEYS.settings]: { version: 1, settings: DEFAULT_SETTINGS } as SettingsStore,
} as const

/** quota 초과를 호출부에 알리기 위한 에러 */
export class StorageQuotaError extends Error {
  constructor() {
    super('LocalStorage quota exceeded')
    this.name = 'StorageQuotaError'
  }
}

function readRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      return parsed as T
    }
    return fallback
  } catch {
    return fallback
  }
}

/** 설정은 필드가 늘어날 수 있으므로 기본값과 병합 */
function normalize(key: Key, value: unknown): unknown {
  if (key === KEYS.settings) {
    const v = value as Partial<SettingsStore>
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, ...(v.settings ?? {}) },
    } satisfies SettingsStore
  }
  return value
}

// 캐시 + 구독 -------------------------------------------------------------
const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()
const errorListeners = new Set<(e: Error) => void>()

function getCached<T>(key: Key): T {
  if (!cache.has(key)) {
    cache.set(key, normalize(key, readRaw(key, DEFAULTS[key])))
  }
  return cache.get(key) as T
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
  )
}

/** silent=true면 실패해도 에러 리스너(사용자 알림)를 부르지 않는다 — 정리 재시도용 */
function setCached<T>(key: Key, value: T, silent = false): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    const err = isQuotaError(e) ? new StorageQuotaError() : (e as Error)
    if (!silent) errorListeners.forEach((cb) => cb(err))
    throw err
  }
  cache.set(key, value)
  listeners.get(key)?.forEach((cb) => cb())
}

function subscribe(key: Key, cb: () => void): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(cb)
  return () => set!.delete(cb)
}

// 다른 탭/창에서 변경된 경우 캐시 무효화 후 알림
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !(Object.values(KEYS) as string[]).includes(e.key)) return
    cache.delete(e.key)
    listeners.get(e.key)?.forEach((cb) => cb())
  })
}

export const storage = {
  subscribe,

  /** 쓰기 실패(용량 초과 등) 알림 구독 */
  onError: (cb: (e: Error) => void) => {
    errorListeners.add(cb)
    return () => {
      errorListeners.delete(cb)
    }
  },

  getExercises: () => getCached<ExercisesStore>(KEYS.exercises),
  setExercises: (v: ExercisesStore) => setCached(KEYS.exercises, v),

  getRoutines: () => getCached<RoutinesStore>(KEYS.routines),
  setRoutines: (v: RoutinesStore) => setCached(KEYS.routines, v),

  getLogs: () => getCached<LogsStore>(KEYS.logs),
  setLogs: (v: LogsStore) => setCached(KEYS.logs, v),
  /** 용량 초과면 조용히 false (오래된 기록 정리 루프용) */
  trySetLogs: (v: LogsStore): boolean => {
    try {
      setCached(KEYS.logs, v, true)
      return true
    } catch (e) {
      if (e instanceof StorageQuotaError) return false
      throw e
    }
  },

  getSession: () => getCached<SessionStore>(KEYS.session),
  setSession: (v: SessionStore) => setCached(KEYS.session, v),

  getSettings: () => getCached<SettingsStore>(KEYS.settings),
  setSettings: (v: SettingsStore) => setCached(KEYS.settings, v),

  keys: KEYS,

  /** JSON 백업 내보내기 */
  exportAll: (): string =>
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        exercises: getCached<ExercisesStore>(KEYS.exercises),
        routines: getCached<RoutinesStore>(KEYS.routines),
        logs: getCached<LogsStore>(KEYS.logs),
      },
      null,
      2,
    ),
}

/** crypto 기반 id 생성 (구형 브라우저 폴백 포함) */
export function uid(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${id}`
}
