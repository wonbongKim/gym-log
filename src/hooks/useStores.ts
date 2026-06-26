import { useCallback, useSyncExternalStore } from 'react'
import { KEYS, storage, uid } from '../storage'
import type { Exercise, ExercisesStore, Routine } from '../types'

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

  return { routines: store.routines, upsert, remove }
}
