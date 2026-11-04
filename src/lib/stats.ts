// 기록 통계/집계 유틸 — 순수 함수만 둔다.
import type { LoggedExercise, Routine, SetRecord, WorkoutLog } from '../types'

/** 최신순 정렬 비교자 (날짜 → 종료 시각) */
export function compareLogsDesc(a: WorkoutLog, b: WorkoutLog): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')
  )
}

/** 추정 1RM (Epley). 맨몸/0kg/0회는 null */
export function e1rm(kg: number | null, reps: number): number | null {
  if (kg == null || kg <= 0 || reps <= 0) return null
  const v = reps === 1 ? kg : kg * (1 + reps / 30)
  return Math.round(v * 2) / 2
}

/** 유효한(횟수 입력된) 세트만 */
export function validSets(sets: SetRecord[]): SetRecord[] {
  return sets.filter((s) => s.reps > 0)
}

export interface ExerciseBest {
  maxKg: number | null
  bestE1rm: number | null
  maxReps: number
  volume: number
}

export function exerciseBest(sets: SetRecord[]): ExerciseBest {
  let maxKg: number | null = null
  let bestE1rm: number | null = null
  let maxReps = 0
  let volume = 0
  for (const s of validSets(sets)) {
    if (s.kg != null && (maxKg == null || s.kg > maxKg)) maxKg = s.kg
    const est = e1rm(s.kg, s.reps)
    if (est != null && (bestE1rm == null || est > bestE1rm)) bestE1rm = est
    if (s.reps > maxReps) maxReps = s.reps
    if (s.kg != null && s.kg > 0) volume += s.kg * s.reps
  }
  return { maxKg, bestE1rm, maxReps, volume }
}

/** 기록의 총 세트 수와 총 볼륨(kg×reps 합) */
export function logStats(exercises: LoggedExercise[]): {
  totalSets: number
  totalVolume: number
} {
  let totalSets = 0
  let totalVolume = 0
  for (const ex of exercises) {
    for (const s of ex.sets) {
      totalSets += 1
      if (s.kg != null && s.kg > 0) totalVolume += s.kg * s.reps
    }
  }
  return { totalSets, totalVolume }
}

/** 운동 시간(분) */
export function logMinutes(log: Pick<WorkoutLog, 'startedAt' | 'finishedAt'>): number {
  const ms = Date.parse(log.finishedAt) - Date.parse(log.startedAt)
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.round(ms / 60000)
}

// 종목별 추이 ----------------------------------------------------------------

export interface ExerciseSession {
  logId: string
  date: string
  routineId: string
  routineName: string
  sets: SetRecord[]
  best: ExerciseBest
}

/** 종목 하나의 기록 히스토리 (오래된 순) */
export function exerciseHistory(
  logs: WorkoutLog[],
  exerciseId: string,
): ExerciseSession[] {
  const out: ExerciseSession[] = []
  for (const log of logs) {
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue
      const sets = validSets(ex.sets)
      if (sets.length === 0) continue
      out.push({
        logId: log.id,
        date: log.date,
        routineId: log.routineId,
        routineName: log.routineName,
        sets,
        best: exerciseBest(sets),
      })
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.logId.localeCompare(b.logId),
  )
}

export interface ExerciseSummary {
  exerciseId: string
  name: string
  sessions: number
  lastDate: string
  maxKg: number | null
  bestE1rm: number | null
  maxReps: number
}

/** 기록에 등장한 모든 종목 요약 (최근 수행순) */
export function exerciseSummaries(
  logs: WorkoutLog[],
  nameOf: (id: string) => string,
): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>()
  // logs는 최신순이라고 가정 → 처음 만나는 snapshot 이름이 최신
  for (const log of logs) {
    for (const ex of log.exercises) {
      const sets = validSets(ex.sets)
      if (sets.length === 0) continue
      const b = exerciseBest(sets)
      const cur = map.get(ex.exerciseId)
      if (!cur) {
        map.set(ex.exerciseId, {
          exerciseId: ex.exerciseId,
          name: nameOf(ex.exerciseId) || ex.exerciseName,
          sessions: 1,
          lastDate: log.date,
          maxKg: b.maxKg,
          bestE1rm: b.bestE1rm,
          maxReps: b.maxReps,
        })
      } else {
        cur.sessions += 1
        if (log.date > cur.lastDate) cur.lastDate = log.date
        if (b.maxKg != null && (cur.maxKg == null || b.maxKg > cur.maxKg))
          cur.maxKg = b.maxKg
        if (b.bestE1rm != null && (cur.bestE1rm == null || b.bestE1rm > cur.bestE1rm))
          cur.bestE1rm = b.bestE1rm
        if (b.maxReps > cur.maxReps) cur.maxReps = b.maxReps
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessions - a.sessions,
  )
}

// 개인 신기록(PR) -------------------------------------------------------------

export type PrKind = 'weight' | 'e1rm' | 'reps'

/**
 * log 안에서 이전 기록 대비 신기록을 세운 종목.
 * 이전 기록이 없는 첫 수행은 PR로 치지 않는다.
 */
export function prsInLog(log: WorkoutLog, allLogs: WorkoutLog[]): Map<string, PrKind> {
  const before = allLogs.filter(
    (l) =>
      l.id !== log.id &&
      (l.date < log.date ||
        (l.date === log.date && (l.finishedAt ?? '') < (log.finishedAt ?? ''))),
  )
  const result = new Map<string, PrKind>()
  for (const ex of log.exercises) {
    const cur = exerciseBest(ex.sets)
    let prev: ExerciseBest | null = null
    for (const l of before) {
      for (const pe of l.exercises) {
        if (pe.exerciseId !== ex.exerciseId) continue
        const b = exerciseBest(pe.sets)
        if (validSets(pe.sets).length === 0) continue
        prev = prev
          ? {
              maxKg:
                b.maxKg != null && (prev.maxKg == null || b.maxKg > prev.maxKg)
                  ? b.maxKg
                  : prev.maxKg,
              bestE1rm:
                b.bestE1rm != null &&
                (prev.bestE1rm == null || b.bestE1rm > prev.bestE1rm)
                  ? b.bestE1rm
                  : prev.bestE1rm,
              maxReps: Math.max(prev.maxReps, b.maxReps),
              volume: 0,
            }
          : b
      }
    }
    if (!prev) continue
    if (cur.maxKg != null && prev.maxKg != null && cur.maxKg > prev.maxKg) {
      result.set(ex.exerciseId, 'weight')
    } else if (
      cur.bestE1rm != null &&
      prev.bestE1rm != null &&
      cur.bestE1rm > prev.bestE1rm
    ) {
      result.set(ex.exerciseId, 'e1rm')
    } else if (cur.maxKg == null && prev.maxKg == null && cur.maxReps > prev.maxReps) {
      // 맨몸 운동은 최대 횟수로
      result.set(ex.exerciseId, 'reps')
    }
  }
  return result
}

export const PR_LABEL: Record<PrKind, string> = {
  weight: '최고 무게',
  e1rm: '추정 1RM',
  reps: '최다 횟수',
}

// 주간/연속 -------------------------------------------------------------------

/** 로컬 기준 YYYY-MM-DD */
export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

/** 해당 주(월~일)의 월요일 */
export function mondayOf(d = new Date()): Date {
  const day = d.getDay() // 0=일
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  mon.setDate(mon.getDate() - diff)
  return mon
}

/** 이번 주 월~일 날짜 7개 */
export function weekDates(d = new Date()): string[] {
  const mon = mondayOf(d)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon)
    x.setDate(mon.getDate() + i)
    return localDate(x)
  })
}

/** 연속 운동 주 수 — 이번 주가 비어 있으면 지난주부터 센다 */
export function weekStreak(logs: WorkoutLog[], now = new Date()): number {
  const weeks = new Set(logs.map((l) => localDate(mondayOf(parseLocalDate(l.date)))))
  const cursor = mondayOf(now)
  if (!weeks.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 7)
  let n = 0
  while (weeks.has(localDate(cursor))) {
    n += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return n
}

// 루틴 ------------------------------------------------------------------------

/**
 * 루틴 예상 소요 시간(분).
 * 같은 루틴의 최근 기록이 있으면 그 평균, 없으면 세트당 3분으로 추정.
 */
export function estimateMinutes(routine: Routine, logs: WorkoutLog[]): number {
  const recent = logs
    .filter((l) => l.routineId === routine.id)
    .slice(0, 3)
    .map(logMinutes)
    .filter((m) => m >= 5 && m <= 240)
  if (recent.length > 0) {
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    return Math.max(5, Math.round(avg / 5) * 5)
  }
  const sets = routine.exercises.reduce((a, e) => a + e.targetSets, 0)
  return Math.max(5, Math.round((sets * 3) / 5) * 5)
}

export function totalTargetSets(routine: Routine): number {
  return routine.exercises.reduce((a, e) => a + e.targetSets, 0)
}

// 포맷 ------------------------------------------------------------------------

const WEEK_KR = ['일', '월', '화', '수', '목', '금', '토']

export function weekdayKr(iso: string): string {
  return WEEK_KR[parseLocalDate(iso).getDay()]
}

/** "11.04 (화)" */
export function shortDateLabel(iso: string): string {
  return `${iso.slice(5).replace('-', '.')} (${weekdayKr(iso)})`
}

/** "2026년 11월 4일 화요일" */
export function longDateLabel(iso: string): string {
  const d = parseLocalDate(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KR[d.getDay()]}요일`
}

/** 오늘/어제/N일 전 */
export function relativeDay(iso: string, now = new Date()): string {
  const today = parseLocalDate(localDate(now)).getTime()
  const diff = Math.round((today - parseLocalDate(iso).getTime()) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`
  return `${Math.floor(diff / 365)}년 전`
}

/** 72 → "1시간 12분" */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

/** 초 → "1:05" / "1:02:03" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 12345 → "12,345" / 1234567 → "1.2t"는 과하므로 그대로 */
export function formatKg(kg: number): string {
  return `${Math.round(kg).toLocaleString()}kg`
}

/**
 * 무게 표기 규칙 (사용자 룰)
 * - 단위 kg, 바벨 종목은 빈봉을 뺀 원판 무게
 * - 0 = 빈봉만 / null(빈칸) = 맨몸 / 음수 = 어시스트(보조) 무게
 */
export function kgLabel(kg: number | null, withUnit = true): string {
  if (kg == null) return '맨몸'
  if (kg === 0) return '빈봉'
  return withUnit ? `${kg}kg` : `${kg}`
}

/** 세트 묶음 요약: 무게가 같으면 "80kg × 10·8·8", 다르면 "80×10 · 75×8" */
export function summarizeSetsShort(sets: SetRecord[]): string {
  if (sets.length === 0) return '-'
  const kgs = new Set(sets.map((s) => s.kg))
  if (kgs.size === 1) {
    return `${kgLabel(sets[0].kg)} × ${sets.map((s) => s.reps).join('·')}`
  }
  return sets.map((s) => `${kgLabel(s.kg, false)}×${s.reps}`).join(' · ')
}

/** 세트 하나 표기: "80kg × 10" / "맨몸 × 12" / "빈봉 × 15" */
export function formatSet(s: Pick<SetRecord, 'kg' | 'reps'>): string {
  return `${kgLabel(s.kg)} × ${s.reps}`
}

/** 세트 메모 모음: "2세트: 가동범위 부족 · 4세트: 무릎 통증" */
export function setNotesSummary(sets: SetRecord[]): string {
  return sets
    .filter((s) => s.note?.trim())
    .map((s) => `${s.setNo}세트: ${s.note!.trim()}`)
    .join(' · ')
}
