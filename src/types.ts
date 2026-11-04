// gym-log 데이터 스키마
// 모든 LocalStorage 값은 최상위에 version 필드를 둔다.
// 새 필드는 모두 optional로 추가해 기존 저장 데이터와 호환을 유지한다.

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
  /** 수행 팁/주의사항 (예: "템포 3-1-1", "무릎 아프면 가동범위 줄이기") */
  note?: string
  /** 기구가 비어 있지 않을 때 쓸 대체 종목 이름들 */
  alternatives?: string[]
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
  /** 세트 완료 체크 (진행 표시 · 휴식 타이머 트리거) */
  done?: boolean
  /** 세트 메모 (예: "8회 이후 가동범위 부족", "무릎 통증으로 중단") */
  note?: string
}

/** 기록 내 종목 (이름은 기록 시점 snapshot) */
export interface LoggedExercise {
  exerciseId: string
  exerciseName: string // snapshot
  /** 루틴의 목표 횟수 snapshot (예: "8~10") */
  targetReps?: string
  sets: SetRecord[]
  /** 종목 완료 체크(기록에도 보존) */
  done?: boolean
  /** 종목 메모 */
  note?: string
  /** 원래 종목 대신 수행한 경우 (기구 사용 중 등) */
  substitutedFrom?: { exerciseId: string; exerciseName: string }
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

/** 휴식 타이머 */
export interface RestTimer {
  /** 종료 시각 ISO */
  endsAt: string
  /** 전체 길이(초) — 진행률 표시용 */
  duration: number
}

/** 진행 중인 운동 세션 (gymlog_session) — 세트 입력마다 즉시 저장 */
export interface WorkoutSession {
  routineId: string
  routineName: string
  startedAt: string
  exercises: LoggedExercise[]
  /** 진행 중인 휴식 타이머 (앱을 나갔다 와도 유지) */
  rest?: RestTimer | null
}

export interface SessionStore {
  version: 1
  session: WorkoutSession | null
}

/** 앱 설정 (gymlog_settings) */
export interface Settings {
  /** 세트 완료 후 기본 휴식 시간(초) */
  restSeconds: number
  /** 휴식 종료 알림음 */
  restSound: boolean
  /** 운동 중 화면 꺼짐 방지 */
  keepAwake: boolean
  /** 마지막 백업 파일 내보내기 시각 ISO */
  lastBackupAt: string | null
}

export interface SettingsStore {
  version: 1
  settings: Settings
}
