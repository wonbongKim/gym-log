// gym-log 데이터 스키마
// 모든 LocalStorage 값은 최상위에 version 필드를 둔다.

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** 운동 종목 마스터 (gymlog_exercises) */
export interface Exercise {
  id: string
  name: string
  /** true면 맨몸 운동(보조무게 음수/0 허용) */
  bodyweight: boolean
}

export interface ExercisesStore {
  version: 1
  exercises: Exercise[]
}

/** 루틴 내 종목 (마스터를 exerciseId로 참조) */
export interface RoutineExercise {
  exerciseId: string
  targetSets: number
  targetReps: string // "8~10" 처럼 범위 표기 허용
  order: number
}

/** 루틴 정의 = 템플릿 (gymlog_routines) */
export interface Routine {
  id: string
  name: string
  days: WeekDay[]
  exercises: RoutineExercise[]
}

export interface RoutinesStore {
  version: 1
  routines: Routine[]
}

/** 한 세트 기록 */
export interface SetRecord {
  setNo: number
  /** 맨몸은 null, 어시스트 머신은 음수 허용 */
  kg: number | null
  reps: number
}

/** 기록 내 종목 (이름은 기록 시점 snapshot) */
export interface LoggedExercise {
  exerciseId: string
  exerciseName: string // snapshot
  sets: SetRecord[]
  /** 세션 진행 중 완료 체크(기록에도 보존) */
  done?: boolean
}

/** 운동 기록 = 사실 (gymlog_logs) */
export interface WorkoutLog {
  id: string
  date: string // "YYYY-MM-DD"
  routineId: string
  routineName: string // snapshot
  startedAt: string // ISO
  finishedAt: string // ISO
  exercises: LoggedExercise[]
}

export interface LogsStore {
  version: 1
  logs: WorkoutLog[]
}

/** 진행 중인 운동 세션 (gymlog_session) — 세트 입력마다 즉시 저장 */
export interface WorkoutSession {
  routineId: string
  routineName: string
  startedAt: string
  exercises: LoggedExercise[]
}

export interface SessionStore {
  version: 1
  session: WorkoutSession | null
}
