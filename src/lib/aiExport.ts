// 기간별 내보내기 — AI에 붙여넣어 분석받기 좋은 요약 형식 / 원본 형식.
// 외부로 아무것도 전송하지 않는다(복사·공유·파일 저장만).
import type { Exercise, Routine, SetRecord, WorkoutLog } from '../types'
import { exerciseHistory, localDate, logMinutes, validSets } from './stats'
import { overloadForLog, overloadSeries } from './overload'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLE_ORDER } from './exercises'

export type Period = '1m' | '3m' | '6m' | 'all'

export const PERIOD_LABEL: Record<Period, string> = {
  '1m': '1개월',
  '3m': '3개월',
  '6m': '6개월',
  all: '전체',
}

/** 기간 시작일 (포함). 전체면 null */
export function periodFrom(p: Period, now = new Date()): string | null {
  if (p === 'all') return null
  const months = p === '1m' ? 1 : p === '3m' ? 3 : 6
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate() + 1)
  return localDate(d)
}

export const WEIGHT_RULES = [
  '무게 단위는 kg',
  '바벨 종목은 빈봉(봉 무게)을 뺀 원판 무게만 기록',
  '"빈봉" = 빈봉만 사용(원판 0kg)',
  '"맨몸" = 맨몸 운동(무게 없음)',
  '음수 무게 = 어시스트(보조) 머신의 보조 무게 (예: -20 → 20kg 보조, 0에 가까울수록 어려움)',
]

/** "80x10" / "빈봉x15" / "맨몸x12" / "-20x8" */
function setStr(s: SetRecord): string {
  const w = s.kg == null ? '맨몸' : s.kg === 0 ? '빈봉' : String(s.kg)
  return `${w}x${s.reps}`
}

interface ExportOptions {
  /** 기간 내 기록 (정렬 무관) */
  logs: WorkoutLog[]
  /** 과부하 비교용 전체 기록 */
  allLogs: WorkoutLog[]
  routines: Routine[]
  nameOf: (id: string) => string
  /** 종목 정보 (부위·기구) — 없으면 생략 */
  exerciseOf?: (id: string) => Exercise | undefined
  from: string | null
  to: string
  includeRoutines: boolean
  includeNotes: boolean
}

/** AI 분석용 요약 객체 */
export function buildAiExport(o: ExportOptions) {
  const logs = [...o.logs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.finishedAt.localeCompare(b.finishedAt),
  )
  const first = logs[0]?.date ?? o.from ?? o.to

  const routines = o.includeRoutines
    ? o.routines.map((r) => ({
        name: r.name,
        days: r.days,
        exercises: [...r.exercises]
          .sort((a, b) => a.order - b.order)
          .map((e) => ({
            name: o.nameOf(e.exerciseId),
            sets: e.targetSets,
            reps: e.targetReps,
            ...(o.includeNotes && e.note ? { note: e.note } : {}),
            ...(e.alternatives?.length ? { alternatives: e.alternatives } : {}),
          })),
      }))
    : undefined

  // 종목별 요약 (기간 내)
  const exIds = [...new Set(logs.flatMap((l) => l.exercises.map((e) => e.exerciseId)))]
  const exerciseSummary = exIds
    .map((id) => {
      const h = exerciseHistory(logs, id)
      if (h.length === 0) return null
      const name =
        o.nameOf(id) ||
        logs.flatMap((l) => l.exercises).find((e) => e.exerciseId === id)?.exerciseName ||
        id
      const counts = { up: 0, same: 0, down: 0 }
      // 전체 기록 기준으로 판정(기간 첫 회차도 이전 기록과 비교)한 뒤 기간 안 회차만 집계
      const inPeriod = new Set(h.map((x) => x.logId))
      const all = exerciseHistory(o.allLogs, id)
      overloadSeries(all, o.routines, id).forEach((r, i) => {
        if (inPeriod.has(all[i].logId) && r.status !== 'first') counts[r.status] += 1
      })
      const firstE = h[0].best.bestE1rm
      const lastE = h[h.length - 1].best.bestE1rm
      const info = o.exerciseOf?.(id)
      return {
        exercise: name,
        ...(info?.muscle ? { muscle: MUSCLE_LABEL[info.muscle] } : {}),
        ...(info?.equipment ? { equipment: EQUIPMENT_LABEL[info.equipment] } : {}),
        sessions: h.length,
        first: { date: h[0].date, sets: h[0].sets.map(setStr) },
        latest: { date: h[h.length - 1].date, sets: h[h.length - 1].sets.map(setStr) },
        ...(firstE != null && lastE != null
          ? { e1rmStart: firstE, e1rmLatest: lastE, e1rmChange: Math.round((lastE - firstE) * 10) / 10 }
          : {}),
        overloadVsPrevious: counts,
      }
    })
    .filter(Boolean)

  const workouts = logs.map((l) => {
    const ol = overloadForLog(l, o.allLogs, o.routines)
    return {
      date: l.date,
      routine: l.routineName,
      minutes: logMinutes(l) || undefined,
      exercises: l.exercises
        .filter((e) => validSets(e.sets).length > 0)
        .map((e) => {
          const r = ol.get(e.exerciseId)
          const setNotes = o.includeNotes
            ? e.sets.filter((s) => s.note?.trim()).map((s) => `${s.setNo}세트: ${s.note!.trim()}`)
            : []
          return {
            name: e.exerciseName,
            sets: validSets(e.sets).map(setStr),
            ...(e.substitutedFrom ? { insteadOf: e.substitutedFrom.exerciseName } : {}),
            ...(r && r.status !== 'first' ? { vsLast: `${r.status}: ${r.reason}` } : {}),
            ...(o.includeNotes && e.note ? { note: e.note } : {}),
            ...(setNotes.length ? { setNotes } : {}),
          }
        }),
    }
  })

  // 부위별 세트 수 (기간 내 완료 세트, 대체 종목 포함) — 부위 정보가 있을 때만
  const setsByMuscle: Record<string, number> = {}
  if (o.exerciseOf) {
    const counts = new Map<string, number>()
    for (const l of logs) {
      for (const e of l.exercises) {
        const n = validSets(e.sets).length
        if (!n) continue
        const m = o.exerciseOf(e.exerciseId)?.muscle
        const label = m ? MUSCLE_LABEL[m] : '기타'
        counts.set(label, (counts.get(label) ?? 0) + n)
      }
    }
    for (const label of [...MUSCLE_ORDER.map((m) => MUSCLE_LABEL[m]), '기타']) {
      if (counts.has(label)) setsByMuscle[label] = counts.get(label)!
    }
  }
  const hasMuscle = Object.keys(setsByMuscle).length > 0

  return {
    about: {
      app: 'gym-log (개인 운동 기록)',
      exportedAt: new Date().toISOString(),
      period: { from: o.from ?? first, to: o.to },
      workoutCount: logs.length,
      format: {
        sets: '"무게x횟수" 문자열 배열, 세트 순서대로',
        vsLast: '같은 루틴의 같은 종목 직전 수행 대비 점진적 과부하 판정 (up/same/down: 이유)',
        insteadOf: '원래 종목 대신 수행한 경우 원래 종목 이름',
        e1rm: '추정 1RM (Epley 공식, kg)',
        ...(hasMuscle ? { setsByMuscle: '기간 내 부위별 완료 세트 수 (대체 종목 포함)' } : {}),
      },
      weightRules: WEIGHT_RULES,
    },
    ...(routines ? { routines } : {}),
    ...(hasMuscle ? { setsByMuscle } : {}),
    exerciseSummary,
    workouts,
  }
}

/** 원본 형식 (앱 데이터 그대로, 기간 필터) */
export function buildRawExport(o: ExportOptions) {
  const strip = <T extends { note?: string }>(x: T): T => {
    if (o.includeNotes) return x
    const { note: _note, ...rest } = x
    void _note
    return rest as T
  }
  return {
    exportedAt: new Date().toISOString(),
    period: { from: o.from, to: o.to },
    weightRules: WEIGHT_RULES,
    ...(o.includeRoutines ? { routines: o.routines } : {}),
    logs: o.logs.map((l) => ({
      ...l,
      exercises: l.exercises.map((e) => ({ ...strip(e), sets: e.sets.map(strip) })),
    })),
  }
}

/** 들여쓰기 JSON이되, 숫자/문자열만 담긴 배열은 한 줄로 (AI 토큰·가독성 절약) */
export function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(
    /\[\n((?:\s*(?:"(?:[^"\\\n]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null),?\n)+)\s*\]/g,
    (_m, inner: string) =>
      '[' +
      inner
        .split('\n')
        .map((s) => s.trim().replace(/,$/, ''))
        .filter(Boolean)
        .join(', ') +
      ']',
  )
}

/** 분석 요청 문구 */
export function analysisPrompt(from: string, to: string): string {
  return [
    `아래는 내 운동 기록이야 (gym-log 앱에서 내보냄, ${from} ~ ${to}).`,
    '목적: 점진적 과부하가 잘 되고 있는지 확인하고 다음 운동 계획을 세우는 것.',
    '',
    '분석해 줘:',
    '1. 종목별로 점진적 과부하가 되고 있는지 (exerciseSummary, workouts[].vsLast 참고)',
    '2. 정체·후퇴한 종목과 원인 추정 — 메모(note, setNotes)의 통증·가동범위 부족 등도 고려',
    '3. 다음 2주간 종목별 무게·횟수 목표 (빈봉 제외 원판 무게 기준으로)',
    '4. 루틴 구성(부위 균형, 주간 볼륨, 빈도) 개선점 — setsByMuscle(부위별 세트 수)과 기간 참고',
    '',
    `무게 규칙: ${WEIGHT_RULES.join(' / ')}`,
    '',
    '데이터:',
  ].join('\n')
}

export function approxKB(text: string): number {
  return Math.max(1, Math.round(new Blob([text]).size / 1024))
}
