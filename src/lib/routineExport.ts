import type { Routine } from '../types'

/**
 * 루틴을 import와 동일한 형식의 JSON 문자열로 직렬화.
 * exerciseId는 빼고, 사람이 읽기 좋은 종목 이름으로 내보낸다.
 */
export function routineToImportJson(
  routine: Routine,
  nameOf: (id: string) => string,
): string {
  const obj = {
    name: routine.name,
    days: routine.days,
    exercises: [...routine.exercises]
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        name: nameOf(e.exerciseId),
        targetSets: e.targetSets,
        targetReps: e.targetReps,
      })),
  }
  return JSON.stringify(obj, null, 2)
}

/** 여러 루틴을 배열 JSON으로 직렬화 */
export function routinesToImportJson(
  routines: Routine[],
  nameOf: (id: string) => string,
): string {
  const arr = routines.map((r) => JSON.parse(routineToImportJson(r, nameOf)))
  return JSON.stringify(arr, null, 2)
}
