import type { WeekDay } from '../types'
import { exerciseKey } from './exercises'

/** JSON 파싱 결과의 종목 (이름 기준, exerciseId는 적용 시점에 연결) */
export interface ParsedExercise {
  name: string
  /** (선택) 기본 종목 id 등 — 알려진 id면 이름보다 우선해 연결 */
  exerciseId?: string
  targetSets: number
  targetReps: string
  /** 수행 팁/주의사항 */
  note?: string
  /** 기구가 비어 있지 않을 때 쓸 대체 종목 이름들 */
  alternatives?: string[]
}

/** JSON 파싱 결과(종목은 이름 기준, id는 import 시점에 부여) */
export interface ParsedRoutine {
  /** 내보낸 JSON의 루틴 id — "같으면 수정"/"전체 바꾸기"에서 기존 루틴과 매칭할 때 사용 */
  id?: string
  name: string
  days: WeekDay[]
  exercises: ParsedExercise[]
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

const NOTE_KEYS = ['note', 'memo', '메모', 'tip']
const ALT_KEYS = ['alternatives', 'alternative', 'alts', 'substitutes', '대체', '대체종목']

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

/** 이름 비교용 키 (앞뒤 공백 제거 + 대소문자 무시) */
export function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * 대체 종목 입력을 이름 배열로 정리.
 * 배열 / 쉼표로 구분한 문자열 / {name} 객체 배열 모두 허용.
 * 공백·중복·자기 자신(exclude)은 제거한다.
 */
export function normalizeAlternatives(raw: unknown, exclude?: string): string[] {
  const list: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  const out: string[] = []
  const seen = new Set<string>(exclude ? [exerciseKey(exclude)] : [])
  for (const item of list) {
    let value: unknown = item
    if (item && typeof item === 'object') value = pick(item as Record<string, unknown>, ['name', '이름'])
    if (typeof value !== 'string' && typeof value !== 'number') continue
    for (const part of String(value).split(/[,，、\n]/)) {
      const name = part.trim()
      if (!name || seen.has(exerciseKey(name))) continue
      seen.add(exerciseKey(name))
      out.push(name)
    }
  }
  return out
}

function normalizeNote(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .filter((x) => typeof x === 'string' || typeof x === 'number')
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(' / ')
  }
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw).trim()
  return ''
}

export class RoutineParseError extends Error {}

/** 단일 루틴 객체 1개를 파싱 */
function parseOne(data: unknown, idx: number): ParsedRoutine {
  const where = idx >= 0 ? `${idx + 1}번째 루틴: ` : ''
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RoutineParseError(`${where}루틴 객체를 찾을 수 없습니다.`)
  }
  const obj = data as Record<string, unknown>

  const name = pick(obj, ['name', '이름', 'title'])
  if (typeof name !== 'string' || !name.trim()) {
    throw new RoutineParseError(`${where}루틴 이름(name)이 필요합니다.`)
  }

  const rawId = pick(obj, ['id', 'routineId'])
  const id =
    typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : ''

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

  const exercises = rawExercises.map((raw, i): ParsedExercise => {
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

    const ex: ParsedExercise = { name: exName.trim(), targetSets, targetReps }
    const exId = pick(e, ['exerciseId', 'exercise_id', 'id'])
    if (typeof exId === 'string' && /^[A-Za-z0-9_-]{2,80}$/.test(exId.trim())) {
      ex.exerciseId = exId.trim()
    }
    const note = normalizeNote(pick(e, NOTE_KEYS))
    if (note) ex.note = note
    const alternatives = normalizeAlternatives(pick(e, ALT_KEYS), ex.name)
    if (alternatives.length > 0) ex.alternatives = alternatives
    return ex
  })

  const routine: ParsedRoutine = { name: name.trim(), days, exercises }
  if (id) routine.id = id
  return routine
}

/**
 * AI 답변을 통째로 복사한 경우를 위해 JSON 본문만 추려 파싱.
 * 1) ```json 코드 블록 안쪽  2) 원문 그대로  3) 첫 [ 또는 { ~ 마지막 ] 또는 }
 * 4) 스마트 따옴표(“ ”)를 일반 따옴표로 바꿔 재시도
 */
function parseLooseJson(text: string): unknown {
  const candidates: string[] = []
  const fence = text.match(/```[a-zA-Z]*[^\S\n]*\n?([\s\S]*?)```/)
  if (fence && fence[1].trim()) candidates.push(fence[1].trim())
  candidates.push(text)
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'))
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))

  const tries = [
    ...candidates,
    ...candidates.map((c) => c.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")),
  ]
  for (const c of tries) {
    try {
      return JSON.parse(c)
    } catch {
      // 다음 후보로
    }
  }
  throw new RoutineParseError('올바른 JSON 형식이 아닙니다.')
}

/**
 * 붙여넣은 JSON 텍스트를 1개 이상의 ParsedRoutine으로 변환.
 * 단일 객체 / 배열([{...}, {...}]) / {routines:[...]} / {routine:{...}} 모두 허용.
 * AI 답변처럼 ```json 코드 블록이나 앞뒤 설명이 섞여 있어도 JSON 부분만 추려 읽는다.
 */
export function parseRoutinesJson(text: string): ParsedRoutine[] {
  const trimmed = text.trim()
  if (!trimmed) throw new RoutineParseError('JSON을 입력해 주세요.')

  let data: unknown = parseLooseJson(trimmed)

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
      {
        "name": "벤치프레스",
        "targetSets": 3,
        "targetReps": "8~10",
        "note": "2초 동안 내리기, 견갑 고정",
        "alternatives": ["덤벨 벤치프레스", "머신 체스트프레스"]
      },
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
