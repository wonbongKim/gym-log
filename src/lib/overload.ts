// 점진적 과부하 판정 — 같은 종목의 직전 수행과 비교한다.
import type { SetRecord, WorkoutLog } from '../types'
import { validSets } from './stats'

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
const repsAt = (sets: SetRecord[], kg: number) =>
  sets.filter((s) => s.kg === kg).reduce((a, s) => a + s.reps, 0)
const volume = (sets: SetRecord[]) =>
  sets.reduce((a, s) => a + (s.kg != null && s.kg > 0 ? s.kg * s.reps : 0), 0)
const totalReps = (sets: SetRecord[]) => sets.reduce((a, s) => a + s.reps, 0)

/**
 * 판정 순서
 * 1) 최고 무게가 올랐으면 ↑  (어시스트 음수도 "덜 보조" = 증가로 동일 처리)
 * 2) 같은 최고 무게면 그 무게에서의 총 횟수 비교
 * 3) 그다음 볼륨(무게×횟수), 맨몸이면 총 횟수
 * 무게를 내렸어도 볼륨이 늘었으면 ↑ 로 본다.
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
    const cv = volume(c)
    const pv = volume(p)
    if (cw < pw) {
      return cv > pv
        ? { status: 'up', reason: `볼륨 ${signed(cv - pv)}kg` }
        : { status: 'down', reason: `무게 ${signed(cw - pw)}kg` }
    }
    const cr = repsAt(c, cw)
    const pr = repsAt(p, pw)
    const at = cw === 0 ? '빈봉' : `${cw}kg`
    if (cr > pr) return { status: 'up', reason: `${at}에서 ${signed(cr - pr)}회` }
    if (cv > pv) return { status: 'up', reason: `볼륨 ${signed(cv - pv)}kg` }
    if (cr < pr) return { status: 'down', reason: `${at}에서 ${signed(cr - pr)}회` }
    if (cv < pv) return { status: 'down', reason: `볼륨 ${signed(cv - pv)}kg` }
    // 같은 무게·횟수면 세트 수/총 횟수로
    const tr = totalReps(c) - totalReps(p)
    if (tr > 0) return { status: 'up', reason: `총 ${signed(tr)}회` }
    if (tr < 0) return { status: 'down', reason: `총 ${signed(tr)}회` }
    return { status: 'same', reason: '지난번과 동일' }
  }

  // 맨몸(또는 맨몸↔중량 혼합): 총 횟수
  const tr = totalReps(c) - totalReps(p)
  if (tr > 0) return { status: 'up', reason: `총 ${signed(tr)}회` }
  if (tr < 0) return { status: 'down', reason: `총 ${signed(tr)}회` }
  return { status: 'same', reason: '지난번과 동일' }
}

/** 이 기록의 종목별 과부하 판정 (직전 수행 = 이 기록보다 앞선 가장 최근 기록) */
export function overloadForLog(
  log: WorkoutLog,
  allLogs: WorkoutLog[],
): Map<string, OverloadResult> {
  const before = allLogs
    .filter(
      (l) =>
        l.id !== log.id &&
        (l.date < log.date ||
          (l.date === log.date && (l.finishedAt ?? '') < (log.finishedAt ?? ''))),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
    )
  const out = new Map<string, OverloadResult>()
  for (const ex of log.exercises) {
    let prev: SetRecord[] | null = null
    for (const l of before) {
      const pe = l.exercises.find((e) => e.exerciseId === ex.exerciseId && validSets(e.sets).length)
      if (pe) {
        prev = pe.sets
        break
      }
    }
    out.set(ex.exerciseId, compareSessions(ex.sets, prev))
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
