import type { Routine } from '../types'
import { formatDays } from './days'
import { exerciseKey } from './exercises'
import { nameKey, type ParsedExercise, type ParsedRoutine } from './routineImport'

/** 붙여넣은 종목 → 이미 있는 종목 id (기본 종목·내 종목·별칭 포함). 처음 보는 이름이면 null */
export type ResolveExerciseId = (e: ParsedExercise) => string | null

/**
 * JSON 가져오기 적용 방식
 * - add: 항상 새 루틴으로 추가 (id 무시)
 * - merge: id → 이름 순으로 기존 루틴과 매칭해 제자리 수정, 나머지는 추가
 * - replace: 붙여넣은 목록이 전체 루틴 목록이 됨 (매칭된 루틴은 id 유지, 나머지 기존 루틴은 삭제)
 */
export type ImportMode = 'add' | 'merge' | 'replace'

export interface ImportPlanItem {
  parsed: ParsedRoutine
  /** 매칭된 기존 루틴 (add 모드거나 매칭 실패면 null → 새 루틴) */
  target: Routine | null
  matchedBy: 'id' | 'name' | null
  /** 기존 루틴 대비 짧은 변경 요약 (예: "종목 5→6 (+1)") — 비어 있으면 변경 없음 */
  changes: string[]
  /** 기존 루틴에 없던 종목 (parsed.exercises 인덱스) */
  newExerciseIdx: number[]
  /** 기존 루틴에서 빠지는 종목 이름 */
  droppedExercises: string[]
}

export interface ImportPlan {
  mode: ImportMode
  items: ImportPlanItem[]
  /** replace 모드에서 삭제될 기존 루틴 */
  removed: Routine[]
  /** 새로 생기는 루틴 수 */
  added: number
  /** 실제로 내용이 바뀌는 기존 루틴 수 */
  updated: number
  /** 매칭됐지만 바뀌는 게 없는 루틴 수 */
  unchanged: number
}

/**
 * 붙여넣은 루틴을 기존 루틴과 매칭.
 * 1차: id 일치, 2차: 이름 일치(앞뒤 공백 제거·대소문자 무시). 기존 루틴 하나는 한 번만 매칭된다.
 */
export function matchRoutines(
  parsed: ParsedRoutine[],
  existing: Routine[],
): { target: Routine | null; matchedBy: 'id' | 'name' | null }[] {
  const claimed = new Set<string>()
  const result: { target: Routine | null; matchedBy: 'id' | 'name' | null }[] = parsed.map(
    () => ({ target: null, matchedBy: null }),
  )

  parsed.forEach((p, i) => {
    if (!p.id) return
    const r = existing.find((x) => x.id === p.id)
    if (r && !claimed.has(r.id)) {
      claimed.add(r.id)
      result[i] = { target: r, matchedBy: 'id' }
    }
  })

  parsed.forEach((p, i) => {
    if (result[i].target) return
    const key = nameKey(p.name)
    const r = existing.find((x) => !claimed.has(x.id) && nameKey(x.name) === key)
    if (r) {
      claimed.add(r.id)
      result[i] = { target: r, matchedBy: 'name' }
    }
  })

  return result
}

function sameList(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = a ?? []
  const y = b ?? []
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/** 기존 루틴 → 붙여넣은 루틴의 변경 요약 */
export function diffRoutine(
  p: ParsedRoutine,
  r: Routine,
  nameOf: (id: string) => string,
  resolveId: ResolveExerciseId,
): Pick<ImportPlanItem, 'changes' | 'newExerciseIdx' | 'droppedExercises'> {
  const changes: string[] = []

  if (p.name.trim() !== r.name.trim()) changes.push('이름 변경')

  const oldDays = formatDays(r.days)
  const newDays = formatDays(p.days)
  if (oldDays !== newDays) changes.push(`요일 ${oldDays || '없음'}→${newDays}`)

  // 종목은 id로 비교 — "벤치 프레스"·"바벨 벤치프레스"처럼 이름만 달라도 같은 종목이면 변경 아님
  const oldEx = [...r.exercises].sort((a, b) => a.order - b.order)
  const oldKeys = oldEx.map((e) => e.exerciseId)
  const newKeys = p.exercises.map((e) => resolveId(e) ?? `new:${exerciseKey(e.name)}`)

  const newExerciseIdx = newKeys.flatMap((k, i) => (oldKeys.includes(k) ? [] : [i]))
  const droppedExercises = oldEx
    .filter((_, i) => !newKeys.includes(oldKeys[i]))
    .map((e) => nameOf(e.exerciseId) || '(이름 없음)')

  const countPart =
    oldEx.length !== p.exercises.length ? `종목 ${oldEx.length}→${p.exercises.length}` : '종목'
  if (newExerciseIdx.length || droppedExercises.length) {
    const delta = [
      newExerciseIdx.length ? `+${newExerciseIdx.length}` : '',
      droppedExercises.length ? `−${droppedExercises.length}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    changes.push(`${countPart} (${delta})`)
  } else if (oldEx.length !== p.exercises.length) {
    changes.push(countPart)
  }

  // 양쪽에 다 있는 종목의 세부 변경
  let setsReps = 0
  let extras = 0
  const used = new Set<number>()
  for (const [ni, e] of p.exercises.entries()) {
    const k = newKeys[ni]
    const idx = oldKeys.findIndex((ok, i) => ok === k && !used.has(i))
    if (idx < 0) continue
    used.add(idx)
    const o = oldEx[idx]
    if (o.targetSets !== e.targetSets || (o.targetReps ?? '').trim() !== e.targetReps.trim()) {
      setsReps++
    }
    if ((o.note?.trim() ?? '') !== (e.note ?? '') || !sameList(o.alternatives, e.alternatives)) {
      extras++
    }
  }
  if (setsReps) changes.push(`세트·횟수 ${setsReps}곳`)
  if (extras) changes.push(`메모·대체 ${extras}곳`)

  // 종목 구성은 같은데 순서만 바뀐 경우 (구성이 바뀌면 위 요약으로 충분)
  if (!newExerciseIdx.length && !droppedExercises.length) {
    if (!sameList(newKeys, oldKeys)) changes.push('순서 변경')
  }

  return { changes, newExerciseIdx, droppedExercises }
}

/** 미리보기·적용에 공통으로 쓰는 가져오기 계획 */
export function planImport(
  parsed: ParsedRoutine[],
  existing: Routine[],
  mode: ImportMode,
  nameOf: (id: string) => string,
  resolveId: ResolveExerciseId,
): ImportPlan {
  const matches =
    mode === 'add'
      ? parsed.map(() => ({ target: null, matchedBy: null }))
      : matchRoutines(parsed, existing)

  const items: ImportPlanItem[] = parsed.map((p, i) => {
    const { target, matchedBy } = matches[i]
    if (!target) {
      return {
        parsed: p,
        target: null,
        matchedBy: null,
        changes: [],
        newExerciseIdx: [],
        droppedExercises: [],
      }
    }
    return { parsed: p, target, matchedBy, ...diffRoutine(p, target, nameOf, resolveId) }
  })

  const matchedIds = new Set(items.flatMap((it) => (it.target ? [it.target.id] : [])))
  const removed = mode === 'replace' ? existing.filter((r) => !matchedIds.has(r.id)) : []

  return {
    mode,
    items,
    removed,
    added: items.filter((it) => !it.target).length,
    updated: items.filter((it) => it.target && it.changes.length > 0).length,
    unchanged: items.filter((it) => it.target && it.changes.length === 0).length,
  }
}

/** 앱이 만든 id 형태(예: rt_xxxxxxxx-...)만 그대로 살린다 */
const SAFE_ID = /^[A-Za-z0-9_-]{4,80}$/

/** 적용해도 아무것도 바뀌지 않는 계획인지 */
export function isNoopPlan(plan: ImportPlan): boolean {
  return plan.added === 0 && plan.updated === 0 && plan.removed.length === 0
}

/**
 * 계획을 실제 루틴 배열로 적용.
 * - 매칭된 루틴은 기존 id를 유지(운동 기록의 routineId 연결 보존)하고, 변경이 없으면 기존 객체를 그대로 둔다.
 * - 새 루틴은 add 모드면 항상 새 id, 그 외엔 붙여넣은 id가 비어 있지 않고 겹치지 않으면 그 id를 쓴다.
 */
export function applyImportPlan(
  plan: ImportPlan,
  existing: Routine[],
  build: (p: ParsedRoutine, id: string) => Routine,
  newId: () => string,
): Routine[] {
  const taken = new Set(existing.map((r) => r.id))
  const idFor = (p: ParsedRoutine): string => {
    // 다른 기기/백업에서 온 id면 그대로 살려 기록 연결을 유지 (AI가 지어낸 이상한 값은 버림)
    if (plan.mode !== 'add' && p.id && SAFE_ID.test(p.id) && !taken.has(p.id)) {
      taken.add(p.id)
      return p.id
    }
    let id = newId()
    while (taken.has(id)) id = newId()
    taken.add(id)
    return id
  }

  const resolve = (it: ImportPlanItem): Routine =>
    it.target
      ? it.changes.length > 0
        ? build(it.parsed, it.target.id)
        : it.target
      : build(it.parsed, idFor(it.parsed))

  if (plan.mode === 'replace') {
    return plan.items.map(resolve)
  }

  if (plan.mode === 'merge') {
    const byTarget = new Map(
      plan.items.flatMap((it) => (it.target ? [[it.target.id, it] as const] : [])),
    )
    const updated = existing.map((r) => {
      const it = byTarget.get(r.id)
      return it ? resolve(it) : r
    })
    const fresh = plan.items.filter((it) => !it.target).map(resolve)
    return [...updated, ...fresh]
  }

  return [...existing, ...plan.items.map(resolve)]
}
