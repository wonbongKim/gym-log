import { useCallback } from 'react'
import { storage, uid } from '../storage'
import { useExercises } from './useStores'
import type { ParsedRoutine } from '../lib/routineImport'
import { applyImportPlan, planImport, type ImportMode } from '../lib/routineMerge'
import type { Exercise, Routine } from '../types'

/** 이름 기반 루틴 → 종목 마스터(exerciseId)에 연결된 Routine */
function buildRoutine(
  p: ParsedRoutine,
  id: string,
  ensureExercise: (name: string) => Exercise,
): Routine {
  return {
    id,
    name: p.name,
    days: p.days,
    exercises: p.exercises.map((e, idx) => ({
      exerciseId: ensureExercise(e.name).id,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      order: idx,
      ...(e.note ? { note: e.note } : {}),
      ...(e.alternatives && e.alternatives.length > 0
        ? { alternatives: [...e.alternatives] }
        : {}),
    })),
  }
}

/** 이름 기반 루틴(JSON 가져오기/예시)을 종목 마스터에 연결해 새 루틴으로 저장 */
export function useAddParsedRoutines() {
  const { ensureExercise } = useExercises()

  return useCallback(
    (parsed: ParsedRoutine[]): Routine[] => {
      // 종목을 먼저 만들어 두고(ensureExercise가 exercises 스토어를 갱신) 루틴은 한 번에 저장
      const built = parsed.map((p) => buildRoutine(p, uid('rt'), ensureExercise))
      const current = storage.getRoutines()
      storage.setRoutines({ ...current, routines: [...current.routines, ...built] })
      return built
    },
    [ensureExercise],
  )
}

export interface RoutineImportResult {
  mode: ImportMode
  added: number
  updated: number
  removed: number
  /** 적용 직전의 루틴 배열로 정확히 되돌린다 */
  undo: () => void
}

/**
 * JSON 가져오기를 모드별로 적용 (새로 추가 / 같으면 수정 / 전체 바꾸기).
 * 미리보기와 같은 planImport를 최신 스토리지 기준으로 다시 계산해 적용한다.
 */
export function useApplyRoutineImport() {
  const { ensureExercise } = useExercises()

  return useCallback(
    (parsed: ParsedRoutine[], mode: ImportMode): RoutineImportResult => {
      const previous = storage.getRoutines()
      const names = new Map(storage.getExercises().exercises.map((e) => [e.id, e.name]))
      const nameOf = (id: string) => names.get(id) ?? ''

      const plan = planImport(parsed, previous.routines, mode, nameOf)
      const routines = applyImportPlan(
        plan,
        previous.routines,
        (p, id) => buildRoutine(p, id, ensureExercise),
        () => uid('rt'),
      )
      storage.setRoutines({ ...previous, routines })

      return {
        mode,
        added: plan.added,
        updated: plan.updated,
        removed: plan.removed.length,
        undo: () => storage.setRoutines(previous),
      }
    },
    [ensureExercise],
  )
}
