// 점진적 과부하 판정 — 같은 종목의 "비교 기준 수행"과 비교한다.
import type { Routine, SetRecord, WorkoutLog } from '../types'
import { compareLogsDesc, exerciseBest, validSets } from './stats'

export type OverloadStatus = 'up' | 'same' | 'down' | 'first'

export interface OverloadResult {
  status: OverloadStatus
  /** 무엇이 달라졌는지 짧은 설명 ("+2.5kg", "80kg에서 +3회" …) */
  reason: string
}

const round1 = (n: number) => Math.round(n * 10) / 10
const signed = (n: number) => `${n > 0 ? '+' : '−'}${round1(Math.abs(n)).toLocaleString()}`

function topKg(sets: SetRecord[]): number | null {
  let top: number | null = null
  for (const s of sets) if (s.kg != null && (top == null || s.kg > top)) top = s.kg
  return top
}
const sumReps = (sets: SetRecord[]) => sets.reduce((a, s) => a + s.reps, 0)

/**
 * 세트 단위 비교 — 세트 수가 다른 날(예: 월 3세트 / 금 2세트)도 공정하게.
 * 앞에서부터 겹치는 세트 수(k)만큼의 횟수 합을 비교하고, 같으면 세트 수를 본다.
 * 세트 수만 적은 건 "후퇴"가 아니라 같은 수준으로 본다.
 */
function comparePerSet(c: SetRecord[], p: SetRecord[], at: string): OverloadResult | null {
  const k = Math.min(c.length, p.length)
  const cr = sumReps(c.slice(0, k))
  const pr = sumReps(p.slice(0, k))
  const where = at ? `${at}에서 ` : ''
  if (cr > pr) return { status: 'up', reason: `${where}${signed(cr - pr)}회` }
  if (cr < pr) return { status: 'down', reason: `${where}${signed(cr - pr)}회` }
  if (c.length > p.length) return { status: 'up', reason: `${where}세트 ${signed(c.length - p.length)}` }
  if (c.length < p.length) {
    return { status: 'same', reason: `세트당 같은 수준 (세트 ${signed(c.length - p.length)})` }
  }
  return null
}

/**
 * 판정 순서
 * 1) 최고 무게가 올랐으면 ↑  (어시스트 음수도 "덜 보조" = 증가로 동일 처리)
 * 2) 무게를 내렸으면, 추정 1RM이 올랐을 때만 ↑ (더 많은 반복으로 만회) 아니면 ↓
 * 3) 같은 최고 무게면 그 무게의 세트들을 세트 단위로 비교
 * 맨몸(또는 맨몸↔중량 혼합)은 전체 세트를 세트 단위로 비교
 */
export function compareSessions(cur: SetRecord[], prev: SetRecord[] | null): OverloadResult {
  const c = validSets(cur)
  const p = prev ? validSets(prev) : []
  if (p.length === 0) return { status: 'first', reason: '첫 기록' }
  if (c.length === 0) return { status: 'same', reason: '기록 없음' }

  const cw = topKg(c)
  const pw = topKg(p)
  if (cw != null && pw != null) {
    if (cw > pw) return { status: 'up', reason: `무게 ${signed(cw - pw)}kg` }
    if (cw < pw) {
      const ce = exerciseBest(c).bestE1rm
      const pe = exerciseBest(p).bestE1rm
      return ce != null && pe != null && ce > pe
        ? { status: 'up', reason: `추정 1RM ${signed(ce - pe)}kg` }
        : { status: 'down', reason: `무게 ${signed(cw - pw)}kg` }
    }
    const at = cw === 0 ? '빈봉' : `${cw}kg`
    return (
      comparePerSet(
        c.filter((s) => s.kg === cw),
        p.filter((s) => s.kg === pw),
        at,
      ) ?? { status: 'same', reason: '지난번과 동일' }
    )
  }
  return comparePerSet(c, p, '') ?? { status: 'same', reason: '지난번과 동일' }
}

// 비교 기준(직전 수행) 고르기 ------------------------------------------------

/**
 * 지금 존재하는 루틴 중, 이 종목을 담고 있는 루틴 id들.
 * 월/금처럼 같은 종목을 일부러 다른 강도로 하는 경우를 구분하는 데 쓴다.
 */
export function liveRoutineIdsWith(routines: Routine[], exerciseId: string): Set<string> {
  return new Set(
    routines.filter((r) => r.exercises.some((e) => e.exerciseId === exerciseId)).map((r) => r.id),
  )
}

/**
 * candidatesDesc: 대상보다 앞선 같은 종목 수행들(최신순)
 * 1) 같은 루틴의 가장 최근 수행
 * 2) 없으면, "이 종목을 따로 하는 다른 현재 루틴"을 제외한 가장 최근 수행
 *    (예전 루틴·삭제된 루틴·루틴 밖 추가 종목 등 — 루틴을 바꿔도 기록이 이어지도록)
 * 3) 둘 다 없으면 null → 이 루틴에선 첫 기록
 */
export function pickPrevious<T extends { routineId: string }>(
  candidatesDesc: T[],
  routineId: string,
  liveIds: Set<string>,
): T | null {
  let fallback: T | null = null
  for (const c of candidatesDesc) {
    if (c.routineId === routineId) return c
    if (!fallback && !liveIds.has(c.routineId)) fallback = c
  }
  return fallback
}

/** logs(정렬 무관)에서 종목의 비교 기준 수행을 찾는다 */
export function previousSetsFor(
  logs: WorkoutLog[],
  exerciseId: string,
  routineId: string,
  routines: Routine[],
  /** 이 기록 이전만 (기록 상세에서 사용) */
  before?: WorkoutLog,
): { date: string; sets: SetRecord[]; note?: string; routineId: string } | null {
  const candidates = [...logs]
    .filter(
      (l) =>
        !before ||
        (l.id !== before.id &&
          (l.date < before.date ||
            (l.date === before.date && (l.finishedAt ?? '') < (before.finishedAt ?? '')))),
    )
    .sort(compareLogsDesc)
    .flatMap((l) => {
      const e = l.exercises.find((x) => x.exerciseId === exerciseId && validSets(x.sets).length)
      return e ? [{ date: l.date, sets: e.sets, note: e.note, routineId: l.routineId }] : []
    })
  const liveIds = liveRoutineIdsWith(routines, exerciseId)
  liveIds.delete(routineId)
  return pickPrevious(candidates, routineId, liveIds)
}

/** 종목 히스토리(오래된 순) 각 회차의 판정 — 회차마다 같은 규칙으로 비교 기준을 고른다 */
export function overloadSeries<T extends { routineId: string; sets: SetRecord[] }>(
  historyAsc: T[],
  routines: Routine[],
  exerciseId: string,
): OverloadResult[] {
  const live = liveRoutineIdsWith(routines, exerciseId)
  return historyAsc.map((h, i) => {
    const ids = new Set(live)
    ids.delete(h.routineId)
    const prev = pickPrevious(historyAsc.slice(0, i).reverse(), h.routineId, ids)
    return compareSessions(h.sets, prev?.sets ?? null)
  })
}

/** 이 기록의 종목별 과부하 판정 */
export function overloadForLog(
  log: WorkoutLog,
  allLogs: WorkoutLog[],
  routines: Routine[],
): Map<string, OverloadResult> {
  const out = new Map<string, OverloadResult>()
  for (const ex of log.exercises) {
    const prev = previousSetsFor(allLogs, ex.exerciseId, log.routineId, routines, log)
    out.set(ex.exerciseId, compareSessions(ex.sets, prev?.sets ?? null))
  }
  return out
}

/** "8~10" / "8-10" / "12" → [lo, hi] */
export function parseRepRange(target?: string): [number, number] | null {
  if (!target) return null
  const m = target.match(/(\d+)\s*[~\-–]\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const one = target.match(/^\s*(\d+)\s*회?\s*$/)
  return one ? [Number(one[1]), Number(one[1])] : null
}

/**
 * 오늘의 목표 (더블 프로그레션):
 * 지난번 모든 세트가 목표 범위 상단에 닿았으면 무게 올리기, 아니면 같은 무게로 +1회.
 */
export function nextTarget(prevSets: SetRecord[] | null, targetReps?: string): string | null {
  const p = prevSets ? validSets(prevSets) : []
  if (p.length === 0) return null
  const range = parseRepRange(targetReps)
  const weighted = p.some((s) => s.kg != null)
  if (range && weighted && p.every((s) => s.reps >= range[1])) {
    return `지난번 모든 세트 ${range[1]}회 달성 → 무게 올릴 차례`
  }
  if (!weighted) return '지난번보다 총 횟수 +1회 이상'
  return '같은 무게로 한 세트라도 +1회'
}

export const OVERLOAD_LABEL: Record<OverloadStatus, string> = {
  up: '과부하 ↑',
  same: '유지',
  down: '감소 ↓',
  first: '첫 기록',
}
