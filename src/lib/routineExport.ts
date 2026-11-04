import type { Routine, WeekDay } from '../types'

/** import 형식과 같은 모양의 루틴 객체 (종목은 이름 기준) */
export interface ImportJsonRoutine {
  id: string
  name: string
  days: WeekDay[]
  exercises: {
    name: string
    targetSets: number
    targetReps: string
    note?: string
    alternatives?: string[]
  }[]
}

/**
 * 루틴을 import 형식 객체로 변환.
 * exerciseId는 빼고 사람이 읽기 좋은 종목 이름으로 바꾸되,
 * 루틴 id는 남겨 두어 다시 가져올 때(같으면 수정/전체 바꾸기) 같은 루틴으로 매칭되게 한다.
 */
export function routineToImportObject(
  routine: Routine,
  nameOf: (id: string) => string,
): ImportJsonRoutine {
  return {
    id: routine.id,
    name: routine.name,
    days: routine.days,
    exercises: [...routine.exercises]
      .sort((a, b) => a.order - b.order)
      .map((e) => {
        const ex: ImportJsonRoutine['exercises'][number] = {
          name: nameOf(e.exerciseId),
          targetSets: e.targetSets,
          targetReps: e.targetReps,
        }
        if (e.note?.trim()) ex.note = e.note.trim()
        if (e.alternatives && e.alternatives.length > 0) ex.alternatives = [...e.alternatives]
        return ex
      }),
  }
}

/** 루틴 1개를 import와 동일한 형식의 JSON 문자열로 직렬화 */
export function routineToImportJson(
  routine: Routine,
  nameOf: (id: string) => string,
): string {
  return JSON.stringify(routineToImportObject(routine, nameOf), null, 2)
}

/** 여러 루틴을 배열 JSON으로 직렬화 */
export function routinesToImportJson(
  routines: Routine[],
  nameOf: (id: string) => string,
): string {
  return JSON.stringify(
    routines.map((r) => routineToImportObject(r, nameOf)),
    null,
    2,
  )
}

/** `{ "a": 1, "b": "x" }` 처럼 한 줄로, 키·값 사이에 공백을 둔 JSON */
function inlineJson(obj: object): string {
  const body = Object.entries(obj)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(', ')
  return `{ ${body} }`
}

/**
 * 같은 내용을 종목 1개당 한 줄로 줄인 JSON (AI 요청문에 붙일 때 짧고 보기 좋게).
 * 결과는 그대로 parseRoutinesJson으로 읽을 수 있는 올바른 JSON이다.
 */
export function routinesToCompactJson(
  routines: Routine[],
  nameOf: (id: string) => string,
): string {
  if (routines.length === 0) return '[]'
  const blocks = routines.map((r) => {
    const o = routineToImportObject(r, nameOf)
    const exercises = o.exercises.map((e) => `      ${inlineJson(e)}`).join(',\n')
    return [
      '  {',
      `    "id": ${JSON.stringify(o.id)},`,
      `    "name": ${JSON.stringify(o.name)},`,
      `    "days": ${JSON.stringify(o.days)},`,
      '    "exercises": [',
      exercises,
      '    ]',
      '  }',
    ].join('\n')
  })
  return `[\n${blocks.join(',\n')}\n]`
}
