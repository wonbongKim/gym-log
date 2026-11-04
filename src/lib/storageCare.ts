// 저장 공간 관리 — LocalStorage 사용량 추정 + 오래된 기록부터 정리
import { KEYS, storage } from '../storage'
import type { WorkoutLog } from '../types'
import { compareLogsDesc, localDate } from './stats'

/**
 * 브라우저 LocalStorage 한도는 보통 출처(origin)당 약 5MB(UTF-16 문자 기준).
 * 정확한 값은 브라우저마다 달라 보수적으로 5MB로 본다.
 * ※ GitHub Pages(<아이디>.github.io)는 같은 아이디의 다른 저장소 사이트와 한도를 나눠 쓴다.
 */
export const QUOTA_BYTES = 5 * 1024 * 1024

export interface StorageUsage {
  /** gym-log 키 합계 */
  appBytes: number
  /** 이 출처 전체 */
  totalBytes: number
  logsBytes: number
  ratio: number
}

export function storageUsage(): StorageUsage {
  const ours = new Set<string>(Object.values(KEYS))
  let appBytes = 0
  let totalBytes = 0
  let logsBytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const bytes = (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2
      totalBytes += bytes
      if (ours.has(k)) appBytes += bytes
      if (k === KEYS.logs) logsBytes = bytes
    }
  } catch {
    // 접근 불가(사생활 보호 모드 등)
  }
  return { appBytes, totalBytes, logsBytes, ratio: Math.min(1, totalBytes / QUOTA_BYTES) }
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}

/** 오래된 순 */
function oldestFirst(): WorkoutLog[] {
  return [...storage.getLogs().logs].sort(compareLogsDesc).reverse()
}

export interface PruneResult {
  removed: WorkoutLog[]
  /** "2025.01.02 ~ 2025.02.10" */
  range: string
}

function rangeOf(removed: WorkoutLog[]): string {
  if (removed.length === 0) return ''
  const dates = removed.map((l) => l.date).sort()
  const f = (d: string) => d.replace(/-/g, '.')
  return dates[0] === dates[dates.length - 1]
    ? f(dates[0])
    : `${f(dates[0])} ~ ${f(dates[dates.length - 1])}`
}

/** 가장 오래된 기록 n개 삭제 */
export function pruneOldest(n: number): PruneResult {
  const sorted = oldestFirst()
  const removed = sorted.slice(0, n)
  const keep = new Set(sorted.slice(n).map((l) => l.id))
  const cur = storage.getLogs()
  storage.setLogs({ ...cur, logs: cur.logs.filter((l) => keep.has(l.id)) })
  return { removed, range: rangeOf(removed) }
}

/** 기준일(YYYY-MM-DD)보다 이전 기록 삭제 */
export function pruneBefore(date: string): PruneResult {
  const cur = storage.getLogs()
  const removed = cur.logs.filter((l) => l.date < date)
  storage.setLogs({ ...cur, logs: cur.logs.filter((l) => l.date >= date) })
  return { removed, range: rangeOf(removed) }
}

export function countBefore(date: string): number {
  return storage.getLogs().logs.filter((l) => l.date < date).length
}

export function monthsAgo(m: number, now = new Date()): string {
  return localDate(new Date(now.getFullYear(), now.getMonth() - m, now.getDate()))
}

/**
 * 새 기록을 저장할 공간이 생길 때까지 가장 오래된 기록부터 지우며 재시도.
 * 성공하면 지운 목록, 기록을 다 지워도 안 되면 null (다른 데이터가 공간을 차지).
 */
export function addLogMakingRoom(log: WorkoutLog): PruneResult | null {
  const cur = storage.getLogs()
  const rest = oldestFirst()
  const removed: WorkoutLog[] = []
  for (;;) {
    if (storage.trySetLogs({ ...cur, logs: [log, ...rest] })) {
      return { removed, range: rangeOf(removed) }
    }
    if (rest.length === 0) return null
    // 한 번에 2%씩(최소 1개) — 필요한 만큼만 지운다
    removed.push(...rest.splice(0, Math.max(1, Math.ceil(rest.length * 0.02))))
  }
}

/** 용량이 가득 찼을 때 기본 정리량: 기록의 10% (최소 1개) */
export function defaultPruneCount(): number {
  const n = storage.getLogs().logs.length
  return n === 0 ? 0 : Math.max(1, Math.ceil(n * 0.1))
}
