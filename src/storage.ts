// LocalStorage 접근 레이어
// JSON.parse 결과는 any이므로, 각 store는 안전한 기본값으로 폴백한다.

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

const DEFAULTS = {
  exercises: { version: 1, exercises: [] } as ExercisesStore,
  routines: { version: 1, routines: [] } as RoutinesStore,
  logs: { version: 1, logs: [] } as LogsStore,
  session: { version: 1, session: null } as SessionStore,
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    // 최소 검증: 객체이고 version 필드가 있으면 수용. 그 외에는 폴백.
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      return parsed as T
    }
    return fallback
  } catch {
    return fallback
  }
}

/** quota 초과를 호출부에 알리기 위한 에러 */
export class StorageQuotaError extends Error {
  constructor() {
    super('LocalStorage quota exceeded')
    this.name = 'StorageQuotaError'
  }
}

function write<T>(key: string, value: T): void {
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
}

export const storage = {
  getExercises: () => read(KEYS.exercises, DEFAULTS.exercises),
  setExercises: (v: ExercisesStore) => write(KEYS.exercises, v),

  getRoutines: () => read(KEYS.routines, DEFAULTS.routines),
  setRoutines: (v: RoutinesStore) => write(KEYS.routines, v),

  getLogs: () => read(KEYS.logs, DEFAULTS.logs),
  setLogs: (v: LogsStore) => write(KEYS.logs, v),

  getSession: () => read(KEYS.session, DEFAULTS.session),
  setSession: (v: SessionStore) => write(KEYS.session, v),

  /** JSON 백업 내보내기 */
  exportAll: (): string =>
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        exercises: read(KEYS.exercises, DEFAULTS.exercises),
        routines: read(KEYS.routines, DEFAULTS.routines),
        logs: read(KEYS.logs, DEFAULTS.logs),
      },
      null,
      2,
    ),
}

/** crypto 기반 id 생성 */
export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
