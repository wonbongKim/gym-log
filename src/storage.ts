// LocalStorage 접근 레이어
// - 인메모리 캐시를 스냅샷의 source of truth로 사용(참조 안정성 → useSyncExternalStore 호환)
// - 키별 구독(pub/sub)으로 모든 컴포넌트 인스턴스가 같은 데이터를 공유

import type {
  ExercisesStore,
  RoutinesStore,
  LogsStore,
  SessionStore,
} from './types'

export const KEYS = {
  exercises: 'gymlog_exercises',
  routines: 'gymlog_routines',
  logs: 'gymlog_logs',
  session: 'gymlog_session',
} as const

type Key = (typeof KEYS)[keyof typeof KEYS]

const DEFAULTS = {
  [KEYS.exercises]: { version: 1, exercises: [] } as ExercisesStore,
  [KEYS.routines]: { version: 1, routines: [] } as RoutinesStore,
  [KEYS.logs]: { version: 1, logs: [] } as LogsStore,
  [KEYS.session]: { version: 1, session: null } as SessionStore,
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

// 캐시 + 구독 -------------------------------------------------------------
const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function getCached<T>(key: Key): T {
  if (!cache.has(key)) {
    cache.set(key, readRaw(key, DEFAULTS[key]))
  }
  return cache.get(key) as T
}

function setCached<T>(key: Key, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.code === 22)
    ) {
      throw new StorageQuotaError()
    }
    throw e
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

export const storage = {
  subscribe,

  getExercises: () => getCached<ExercisesStore>(KEYS.exercises),
  setExercises: (v: ExercisesStore) => setCached(KEYS.exercises, v),

  getRoutines: () => getCached<RoutinesStore>(KEYS.routines),
  setRoutines: (v: RoutinesStore) => setCached(KEYS.routines, v),

  getLogs: () => getCached<LogsStore>(KEYS.logs),
  setLogs: (v: LogsStore) => setCached(KEYS.logs, v),

  getSession: () => getCached<SessionStore>(KEYS.session),
  setSession: (v: SessionStore) => setCached(KEYS.session, v),

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

/** crypto 기반 id 생성 */
export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
