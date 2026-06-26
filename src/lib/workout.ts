import { uid } from '../storage'
import type {
  LoggedExercise,
  Routine,
  SetRecord,
  WorkoutLog,
  WorkoutSession,
} from '../types'

export interface PrevRecord {
  date: string
  sets: SetRecord[]
}

/** 직전 기록의 n번째 세트(없으면 마지막 세트)를 기본값으로 */
function seedSetFromPrev(prev: PrevRecord | null, setNo: number): SetRecord {
  if (prev && prev.sets.length > 0) {
    const src = prev.sets[setNo - 1] ?? prev.sets[prev.sets.length - 1]
    return { setNo, kg: src.kg, reps: src.reps }
  }
  return { setNo, kg: null, reps: 0 }
}

/** 루틴으로 새 세션을 생성. 직전 기록을 기본값으로 채운다. */
export function seedSession(
  routine: Routine,
  nameOf: (id: string) => string,
  prevOf: (exerciseId: string) => PrevRecord | null,
): WorkoutSession {
  const exercises: LoggedExercise[] = [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .map((re) => {
      const prev = prevOf(re.exerciseId)
      const setCount = Math.max(1, re.targetSets)
      const sets: SetRecord[] = Array.from({ length: setCount }, (_, i) =>
        seedSetFromPrev(prev, i + 1),
      )
      return {
        exerciseId: re.exerciseId,
        exerciseName: nameOf(re.exerciseId),
        sets,
        done: false,
      }
    })

  return {
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    exercises,
  }
}

/** 로컬 기준 YYYY-MM-DD */
export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 세션을 확정 기록으로 변환 */
export function sessionToLog(session: WorkoutSession): WorkoutLog {
  return {
    id: uid('log'),
    date: localDate(),
    routineId: session.routineId,
    routineName: session.routineName,
    startedAt: session.startedAt,
    finishedAt: new Date().toISOString(),
    exercises: session.exercises,
  }
}

/** "80kg×10, 80×8" 같은 세트 요약 문자열 */
export function summarizeSets(sets: SetRecord[]): string {
  return sets
    .map((s) => `${s.kg == null ? '맨몸' : `${s.kg}kg`}×${s.reps}`)
    .join(', ')
}
