import type { WeekDay } from '../types'

/** JSON 파싱 결과(종목은 이름 기준, id는 import 시점에 부여) */
export interface ParsedRoutine {
  name: string
  days: WeekDay[]
  exercises: { name: string; targetSets: number; targetReps: string }[]
}

const DAY_ALIASES: Record<string, WeekDay> = {
  mon: 'mon', monday: 'mon', 월: 'mon', 월요일: 'mon',
  tue: 'tue', tuesday: 'tue', 화: 'tue', 화요일: 'tue',
  wed: 'wed', wednesday: 'wed', 수: 'wed', 수요일: 'wed',
  thu: 'thu', thursday: 'thu', 목: 'thu', 목요일: 'thu',
  fri: 'fri', friday: 'fri', 금: 'fri', 금요일: 'fri',
  sat: 'sat', saturday: 'sat', 토: 'sat', 토요일: 'sat',
  sun: 'sun', sunday: 'sun', 일: 'sun', 일요일: 'sun',
}

function normalizeDay(raw: unknown): WeekDay | null {
  if (typeof raw !== 'string') return null
  return DAY_ALIASES[raw.trim().toLowerCase()] ?? null
}

/** 다양한 키 별칭에서 첫 번째로 존재하는 값을 꺼낸다 */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null) return obj[k]
  }
  return undefined
}

export class RoutineParseError extends Error {}

/** 단일 루틴 객체 1개를 파싱 */
function parseOne(data: unknown, idx: number): ParsedRoutine {
  const where = idx >= 0 ? `${idx + 1}번째 루틴: ` : ''
  if (!data || typeof data !== 'object') {
    throw new RoutineParseError(`${where}루틴 객체를 찾을 수 없습니다.`)
  }
  const obj = data as Record<string, unknown>

  const name = pick(obj, ['name', '이름', 'title'])
  if (typeof name !== 'string' || !name.trim()) {
    throw new RoutineParseError(`${where}루틴 이름(name)이 필요합니다.`)
  }

  const rawDays = pick(obj, ['days', '요일', 'day'])
  const dayList = Array.isArray(rawDays) ? rawDays : rawDays != null ? [rawDays] : []
  const days: WeekDay[] = []
  for (const d of dayList) {
    const norm = normalizeDay(d)
    if (!norm) throw new RoutineParseError(`${where}알 수 없는 요일: ${String(d)}`)
    if (!days.includes(norm)) days.push(norm)
  }
  if (days.length === 0) {
    throw new RoutineParseError(`${where}요일(days)을 1개 이상 지정해 주세요.`)
  }

  const rawExercises = pick(obj, ['exercises', '종목', 'items'])
  if (!Array.isArray(rawExercises) || rawExercises.length === 0) {
    throw new RoutineParseError(`${where}운동 종목(exercises)을 1개 이상 넣어 주세요.`)
  }

  const exercises = rawExercises.map((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      throw new RoutineParseError(`${where}${i + 1}번째 종목 형식이 올바르지 않습니다.`)
    }
    const e = raw as Record<string, unknown>
    const exName = pick(e, ['name', '이름', '종목'])
    if (typeof exName !== 'string' || !exName.trim()) {
      throw new RoutineParseError(`${where}${i + 1}번째 종목의 이름이 없습니다.`)
    }
    const setsRaw = pick(e, ['targetSets', 'sets', '세트'])
    const repsRaw = pick(e, ['targetReps', 'reps', '횟수'])
    const targetSets = Math.max(1, Math.floor(Number(setsRaw)) || 3)
    const targetReps =
      repsRaw == null ? '' : String(repsRaw).trim()
    return { name: exName.trim(), targetSets, targetReps }
  })

  return { name: name.trim(), days, exercises }
}

/**
 * 붙여넣은 JSON 텍스트를 1개 이상의 ParsedRoutine으로 변환.
 * 단일 객체 / 배열([{...}, {...}]) / {routines:[...]} / {routine:{...}} 모두 허용.
 */
export function parseRoutinesJson(text: string): ParsedRoutine[] {
  const trimmed = text.trim()
  if (!trimmed) throw new RoutineParseError('JSON을 입력해 주세요.')

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    throw new RoutineParseError('올바른 JSON 형식이 아닙니다.')
  }

  // 래퍼 형태 풀기
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.routines)) data = obj.routines
    else if (obj.routine != null) data = obj.routine
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new RoutineParseError('루틴이 비어 있습니다.')
    }
    return data.map((r, i) => parseOne(r, i))
  }
  return [parseOne(data, -1)]
}

/** 모달 placeholder에 보여줄 예시 (여러 루틴은 배열로) */
export const SAMPLE_JSON = `[
  {
    "name": "월요일 - 가슴/등/삼두",
    "days": ["mon"],
    "exercises": [
      { "name": "벤치프레스", "targetSets": 3, "targetReps": "8~10" },
      { "name": "어시스트 턱걸이", "targetSets": 3, "targetReps": "10~12" }
    ]
  },
  {
    "name": "수요일 - 하체",
    "days": ["wed"],
    "exercises": [
      { "name": "레그프레스", "targetSets": 4, "targetReps": "12~15" }
    ]
  }
]`
