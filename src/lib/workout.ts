import { uid } from '../storage'
import type {
  LoggedExercise,
  Routine,
  SetRecord,
  WorkoutLog,
  WorkoutSession,
} from '../types'
import { kgLabel, localDate } from './stats'

export { localDate, logStats } from './stats'

export interface PrevRecord {
  date: string
  sets: SetRecord[]
  /** 지난번 종목 메모 */
  note?: string
}

/** 직전 기록의 n번째 세트(없으면 마지막 세트)를 기본값으로 */
function seedSetFromPrev(prev: PrevRecord | null, setNo: number): SetRecord {
  if (prev && prev.sets.length > 0) {
    const src = prev.sets[setNo - 1] ?? prev.sets[prev.sets.length - 1]
    return { setNo, kg: src.kg, reps: src.reps, done: false }
  }
  return { setNo, kg: null, reps: 0, done: false }
}

/** 종목 하나를 세트 n개로 시드 */
export function seedExercise(
  exerciseId: string,
  exerciseName: string,
  setCount: number,
  prev: PrevRecord | null,
  targetReps?: string,
): LoggedExercise {
  return {
    exerciseId,
    exerciseName,
    targetReps: targetReps || undefined,
    sets: Array.from({ length: Math.max(1, setCount) }, (_, i) =>
      seedSetFromPrev(prev, i + 1),
    ),
    done: false,
  }
}

/** 루틴으로 새 세션을 생성. 직전 기록을 기본값으로 채운다. */
export function seedSession(
  routine: Routine,
  nameOf: (id: string) => string,
  prevOf: (exerciseId: string) => PrevRecord | null,
): WorkoutSession {
  const exercises: LoggedExercise[] = [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .map((re) =>
      seedExercise(
        re.exerciseId,
        nameOf(re.exerciseId),
        re.targetSets,
        prevOf(re.exerciseId),
        re.targetReps,
      ),
    )

  return {
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    exercises,
    rest: null,
  }
}

/** 세션 진행률 (세트 기준) */
export function sessionProgress(session: WorkoutSession): {
  doneSets: number
  totalSets: number
  doneExercises: number
} {
  let doneSets = 0
  let totalSets = 0
  let doneExercises = 0
  for (const ex of session.exercises) {
    totalSets += ex.sets.length
    const d = ex.sets.filter((s) => s.done).length
    doneSets += d
    if (ex.sets.length > 0 && d === ex.sets.length) doneExercises += 1
  }
  return { doneSets, totalSets, doneExercises }
}

export type SaveMode = 'done' | 'all'

/**
 * 세션을 확정 기록으로 변환.
 * - 'done': 완료 체크한 세트만 저장
 * - 'all' : 횟수가 입력된 세트 모두 저장
 * 빈 세트(0회)는 항상 제외하고, 세트가 남지 않은 종목은 뺀다.
 */
export function sessionToLog(session: WorkoutSession, mode: SaveMode = 'all'): WorkoutLog {
  const exercises: LoggedExercise[] = session.exercises
    .map((ex) => {
      const sets = ex.sets
        .filter((s) => s.reps > 0 && (mode === 'all' || s.done))
        .map((s, i) => ({ ...s, setNo: i + 1 }))
      return {
        ...ex,
        sets,
        done: sets.length > 0 && sets.every((s) => s.done),
      }
    })
    .filter((ex) => ex.sets.length > 0)

  return {
    id: uid('log'),
    date: localDate(new Date(session.startedAt)),
    routineId: session.routineId,
    routineName: session.routineName,
    startedAt: session.startedAt,
    finishedAt: new Date().toISOString(),
    exercises,
  }
}

/** "80kg×10, 80×8" 같은 세트 요약 문자열 */
export function summarizeSets(sets: SetRecord[]): string {
  return sets
    .map((s) => `${kgLabel(s.kg)}×${s.reps}`)
    .join(', ')
}
