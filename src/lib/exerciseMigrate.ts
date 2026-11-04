// 내 종목 ↔ 기본 종목 정리 (앱 시작·백업 복원 때마다 실행, 여러 번 돌려도 결과 같음)
// - 이름/별칭이 기본 종목과 같은 내 종목 → 기본 종목 id로 기록·루틴·진행 중 세션을 옮기고 내 종목에서 뺀다
// - 이름만 띄어쓰기 등으로 다른 내 종목끼리 → 먼저 만든 쪽으로 합친다
// 기록의 exerciseName(그날 이름)은 그대로 둔다.
import { storage } from '../storage'
import type { Exercise, LoggedExercise } from '../types'
import { buildIndex, CATALOG, exerciseKey, isCatalogId } from './exercises'

const catalogIndex = buildIndex(CATALOG)

/** 옮길 id 표 (옛 id → 새 id)와 남길 내 종목 */
export function planReconcile(custom: Exercise[]): { remap: Map<string, string>; keep: Exercise[] } {
  const remap = new Map<string, string>()
  const keep: Exercise[] = []
  const keptByKey = new Map<string, Exercise>()
  for (const ex of custom) {
    if (!ex || typeof ex.id !== 'string' || typeof ex.name !== 'string') continue
    if (isCatalogId(ex.id)) continue // 기본 종목과 같은 id가 저장돼 있으면 기본 종목을 쓴다
    const key = exerciseKey(ex.name)
    const hit = catalogIndex.byKey.get(key)
    if (hit) {
      remap.set(ex.id, hit.id)
      continue
    }
    const dup = keptByKey.get(key)
    if (dup) {
      remap.set(ex.id, dup.id)
      continue
    }
    keptByKey.set(key, ex)
    keep.push(ex)
  }
  return { remap, keep }
}

function remapExercises(list: LoggedExercise[], remap: Map<string, string>): LoggedExercise[] | null {
  let changed = false
  const next = list.map((e) => {
    const id = remap.get(e.exerciseId)
    const fromId = e.substitutedFrom && remap.get(e.substitutedFrom.exerciseId)
    if (!id && !fromId) return e
    changed = true
    return {
      ...e,
      ...(id ? { exerciseId: id } : {}),
      ...(fromId ? { substitutedFrom: { ...e.substitutedFrom!, exerciseId: fromId } } : {}),
    }
  })
  return changed ? next : null
}

/** 정리 실행. 옮긴 내 종목 수를 돌려준다 (용량 부족 등으로 실패하면 0 — 다음 실행 때 다시 시도) */
export function reconcileExercises(): number {
  const exStore = storage.getExercises()
  const custom = Array.isArray(exStore.exercises) ? exStore.exercises : []
  const { remap, keep } = planReconcile(custom)
  if (keep.length === custom.length) return 0

  if (remap.size > 0) {
    // 기록 → 세션 → 루틴 → 내 종목 순서. 중간에 실패해도 내 종목이 남아 있어 다음 실행 때 이어서 옮긴다.
    const logsStore = storage.getLogs()
    let logsChanged = false
    const logs = logsStore.logs.map((l) => {
      const ex = remapExercises(l.exercises, remap)
      if (!ex) return l
      logsChanged = true
      return { ...l, exercises: ex }
    })
    if (logsChanged && !storage.trySetLogs({ ...logsStore, logs })) return 0

    const sessionStore = storage.getSession()
    if (sessionStore.session) {
      const ex = remapExercises(sessionStore.session.exercises, remap)
      if (ex) storage.setSession({ ...sessionStore, session: { ...sessionStore.session, exercises: ex } })
    }

    const routinesStore = storage.getRoutines()
    let routinesChanged = false
    const routines = routinesStore.routines.map((r) => {
      if (!r.exercises.some((e) => remap.has(e.exerciseId))) return r
      routinesChanged = true
      return {
        ...r,
        exercises: r.exercises.map((e) =>
          remap.has(e.exerciseId) ? { ...e, exerciseId: remap.get(e.exerciseId)! } : e,
        ),
      }
    })
    if (routinesChanged) storage.setRoutines({ ...routinesStore, routines })
  }

  storage.setExercises({ ...exStore, version: 1, exercises: keep })
  return remap.size
}
