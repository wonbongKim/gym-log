import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { KEYS, storage, StorageQuotaError, uid } from '../storage'
import type {
  Exercise,
  ExercisesStore,
  LoggedExercise,
  Routine,
  Settings,
  WorkoutLog,
  WorkoutSession,
} from '../types'
import { compareLogsDesc } from '../lib/stats'
import { previousSetsFor } from '../lib/overload'

/** 종목 마스터 훅 */
export function useExercises() {
  const store = useSyncExternalStore<ExercisesStore>(
    (cb) => storage.subscribe(KEYS.exercises, cb),
    storage.getExercises,
  )

  /**
   * 이름으로 종목을 찾고, 없으면 생성해 반환.
   * 항상 최신 스토리지를 기준으로 동작하므로 한 틱에 여러 번 호출돼도 안전.
   */
  const ensureExercise = useCallback(
    (name: string, bodyweight = false): Exercise => {
      const trimmed = name.trim()
      const current = storage.getExercises()
      const found = current.exercises.find(
        (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (found) return found
      const created: Exercise = { id: uid('ex'), name: trimmed, bodyweight }
      storage.setExercises({
        ...current,
        exercises: [...current.exercises, created],
      })
      return created
    },
    [],
  )

  return { exercises: store.exercises, ensureExercise }
}

/** 루틴 훅 */
export function useRoutines() {
  const store = useSyncExternalStore(
    (cb) => storage.subscribe(KEYS.routines, cb),
    storage.getRoutines,
  )

  const upsert = useCallback((routine: Routine) => {
    const current = storage.getRoutines()
    const exists = current.routines.some((r) => r.id === routine.id)
    const routines = exists
      ? current.routines.map((r) => (r.id === routine.id ? routine : r))
      : [...current.routines, routine]
    storage.setRoutines({ ...current, routines })
  }, [])

  const remove = useCallback((id: string) => {
    const current = storage.getRoutines()
    storage.setRoutines({
      ...current,
      routines: current.routines.filter((r) => r.id !== id),
    })
  }, [])

  /** 루틴 복제 (이름 뒤에 "(복사)") — 새 루틴을 반환 */
  const duplicate = useCallback((id: string): Routine | null => {
    const current = storage.getRoutines()
    const src = current.routines.find((r) => r.id === id)
    if (!src) return null
    const copy: Routine = {
      ...structuredClone(src),
      id: uid('rt'),
      name: `${src.name} (복사)`,
    }
    const idx = current.routines.findIndex((r) => r.id === id)
    const routines = [...current.routines]
    routines.splice(idx + 1, 0, copy)
    storage.setRoutines({ ...current, routines })
    return copy
  }, [])

  /** 삭제 되돌리기 — 원래 위치에 다시 끼워 넣는다 */
  const restore = useCallback((routine: Routine, index: number) => {
    const current = storage.getRoutines()
    if (current.routines.some((r) => r.id === routine.id)) return
    const routines = [...current.routines]
    routines.splice(Math.min(index, routines.length), 0, routine)
    storage.setRoutines({ ...current, routines })
  }, [])

  return { routines: store.routines, upsert, remove, duplicate, restore }
}

/** 운동 기록 훅 — logs는 항상 최신순 정렬 */
export function useLogs() {
  const store = useSyncExternalStore(
    (cb) => storage.subscribe(KEYS.logs, cb),
    storage.getLogs,
  )

  const logs = useMemo(() => [...store.logs].sort(compareLogsDesc), [store.logs])

  const addLog = useCallback((log: WorkoutLog) => {
    const current = storage.getLogs()
    storage.setLogs({ ...current, logs: [log, ...current.logs] })
  }, [])

  const remove = useCallback((id: string) => {
    const current = storage.getLogs()
    storage.setLogs({
      ...current,
      logs: current.logs.filter((l) => l.id !== id),
    })
  }, [])

  /**
   * 특정 종목의 비교 기준(직전) 기록.
   * routineId를 주면 같은 루틴의 최근 수행을 우선하고, 이 종목을 따로 하는
   * 다른 현재 루틴(예: 월/금 강도 차이)의 기록은 건너뛴다.
   */
  const lastRecordOf = useCallback(
    (
      exerciseId: string,
      routineId?: string,
    ): { date: string; sets: LoggedExercise['sets']; note?: string } | null => {
      if (routineId) {
        return previousSetsFor(logs, exerciseId, routineId, storage.getRoutines().routines)
      }
      for (const log of logs) {
        const ex = log.exercises.find((e) => e.exerciseId === exerciseId)
        if (ex && ex.sets.length > 0) return { date: log.date, sets: ex.sets, note: ex.note }
      }
      return null
    },
    [logs],
  )

  return { logs, addLog, remove, lastRecordOf }
}

/** 진행 중 운동 세션 훅 */
export function useSession() {
  const store = useSyncExternalStore(
    (cb) => storage.subscribe(KEYS.session, cb),
    storage.getSession,
  )

  const setSession = useCallback((session: WorkoutSession | null) => {
    try {
      storage.setSession({ version: 1, session })
    } catch (e) {
      // 용량 초과는 DialogProvider가 정리 안내를 띄운다. 입력 중 화면이 깨지지 않게 여기서 멈춘다.
      if (!(e instanceof StorageQuotaError)) throw e
    }
  }, [])

  return { session: store.session, setSession }
}

/** 앱 설정 훅 */
export function useSettings() {
  const store = useSyncExternalStore(
    (cb) => storage.subscribe(KEYS.settings, cb),
    storage.getSettings,
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const current = storage.getSettings()
    storage.setSettings({
      ...current,
      settings: { ...current.settings, ...patch },
    })
  }, [])

  return { settings: store.settings, updateSettings }
}

/** 종목 id → 이름 매핑 (마스터 기준) */
export function useExerciseNameOf() {
  const { exercises } = useExercises()
  return useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]))
    return (id: string) => map.get(id) ?? ''
  }, [exercises])
}
