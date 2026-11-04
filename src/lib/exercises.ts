// 운동 종목 = 앱 내장 기본 종목(src/data/exercises.json) + 내가 직접 추가한 종목(LocalStorage).
// 이름은 공백·대소문자·구두점을 무시하고 비교하며, 별칭(aliases)도 같은 종목으로 인식한다.
import rawCatalog from '../data/exercises.json'
import { storage } from '../storage'
import type { Equipment, Exercise, MovementPattern, Muscle } from '../types'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  legs: '하체',
  arms: '팔',
  core: '코어',
}
export const MUSCLE_ORDER: Muscle[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: '바벨',
  dumbbell: '덤벨',
  machine: '머신',
  cable: '케이블',
  smith: '스미스',
  bodyweight: '맨몸',
  assisted: '어시스트',
}

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  chest_press: '가슴 밀기',
  incline_press: '인클라인 밀기',
  chest_fly: '가슴 모으기',
  dip: '딥',
  vertical_push: '머리 위로 밀기',
  lateral_raise: '옆으로 들기',
  front_raise: '앞으로 들기',
  rear_delt: '후면 어깨',
  vertical_pull: '위에서 당기기',
  horizontal_pull: '앞에서 당기기',
  shrug: '으쓱하기',
  squat: '스쿼트·프레스',
  lunge: '런지',
  hinge: '힙 힌지',
  hip_thrust: '힙 쓰러스트',
  knee_extension: '무릎 펴기',
  knee_flexion: '무릎 굽히기',
  hip_abduction: '다리 벌리기',
  hip_adduction: '다리 모으기',
  calf: '종아리',
  curl: '이두 컬',
  triceps: '삼두',
  core_flexion: '복근 굽히기',
  core_stability: '버티기',
}

/** 종목 이름 비교 키 — "벤치 프레스" = "벤치프레스" = "Bench-Press" 처럼 공백·대소문자·구두점 무시 */
export function exerciseKey(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/[\s\-_.·・,()[\]/]/g, '')
}

/** "가슴 · 바벨" 같은 짧은 설명 (정보가 없으면 빈 문자열) */
export function exerciseMeta(ex: Exercise | undefined): string {
  if (!ex) return ''
  return [ex.muscle && MUSCLE_LABEL[ex.muscle], ex.equipment && EQUIPMENT_LABEL[ex.equipment]]
    .filter(Boolean)
    .join(' · ')
}

/** 0kg을 "빈봉"으로 읽는 종목인지 (바벨·스미스, 또는 기구 정보가 없는 종목) */
export function usesEmptyBar(ex: Exercise | undefined): boolean {
  return !ex?.equipment || ex.equipment === 'barbell' || ex.equipment === 'smith'
}

// 기본 종목 불러오기 ----------------------------------------------------------

const CATALOG_ID = /^[a-z][a-z0-9_]*$/

/**
 * exercises.json 검증 후 로드. 잘못된 항목은 건너뛰고 problems에 사유를 남긴다.
 * (id 형식·중복, 부위/패턴/기구 값, 이름·별칭이 다른 종목과 겹치는지)
 */
export function loadCatalog(raw: unknown): { list: Exercise[]; problems: string[] } {
  const problems: string[] = []
  const list: Exercise[] = []
  const ids = new Set<string>()
  const keys = new Map<string, string>()
  if (!Array.isArray(raw)) return { list, problems: ['최상위가 배열이 아니에요'] }

  raw.forEach((item, i) => {
    const e = (item ?? {}) as Record<string, unknown>
    const where = `${i + 1}번째(${String(e.id ?? e.name ?? '?')})`
    const id = typeof e.id === 'string' ? e.id : ''
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!CATALOG_ID.test(id) || id.startsWith('ex_')) {
      return void problems.push(`${where}: id는 영문 소문자·숫자·_ 로 (ex_ 로 시작 불가)`)
    }
    if (ids.has(id)) return void problems.push(`${where}: id 중복`)
    if (!name) return void problems.push(`${where}: name 없음`)
    if (typeof e.muscle !== 'string' || !(e.muscle in MUSCLE_LABEL)) {
      return void problems.push(`${where}: muscle 값이 올바르지 않음`)
    }
    if (typeof e.pattern !== 'string' || !(e.pattern in PATTERN_LABEL)) {
      return void problems.push(`${where}: pattern 값이 올바르지 않음`)
    }
    if (e.equipment != null && (typeof e.equipment !== 'string' || !(e.equipment in EQUIPMENT_LABEL))) {
      return void problems.push(`${where}: equipment 값이 올바르지 않음`)
    }
    const aliases = Array.isArray(e.aliases)
      ? e.aliases.filter((a): a is string => typeof a === 'string' && a.trim() !== '').map((a) => a.trim())
      : []
    const own = new Set<string>()
    for (const n of [name, ...aliases]) {
      const k = exerciseKey(n)
      if (own.has(k)) continue
      own.add(k)
      const other = keys.get(k)
      if (other) problems.push(`${where}: '${n}'이(가) ${other}의 이름/별칭과 겹침 (먼저 나온 쪽 우선)`)
    }
    own.forEach((k) => !keys.has(k) && keys.set(k, id))
    ids.add(id)
    list.push({
      id,
      name,
      ...(aliases.length ? { aliases } : {}),
      muscle: e.muscle as Muscle,
      pattern: e.pattern as MovementPattern,
      ...(e.equipment ? { equipment: e.equipment as Equipment } : {}),
      builtin: true,
    })
  })
  return { list, problems }
}

const loaded = loadCatalog(rawCatalog)
export const CATALOG: Exercise[] = loaded.list
export const CATALOG_PROBLEMS = loaded.problems
const CATALOG_IDS = new Set(CATALOG.map((e) => e.id))

if (import.meta.env?.DEV && CATALOG_PROBLEMS.length > 0) {
  console.error('[exercises.json] 확인이 필요해요:\n' + CATALOG_PROBLEMS.join('\n'))
}

export function isCatalogId(id: string): boolean {
  return CATALOG_IDS.has(id)
}

// 합친 목록 + 이름 색인 ----------------------------------------------------------

export interface ExerciseIndex {
  list: Exercise[]
  byId: Map<string, Exercise>
  /** exerciseKey(이름 또는 별칭) → 종목. 기본 종목이 내 종목보다 우선 */
  byKey: Map<string, Exercise>
}

export function buildIndex(list: Exercise[]): ExerciseIndex {
  const byId = new Map<string, Exercise>()
  const byKey = new Map<string, Exercise>()
  for (const ex of list) {
    if (!byId.has(ex.id)) byId.set(ex.id, ex)
  }
  // 이름을 먼저, 별칭은 나중에 — 어떤 종목의 정식 이름이 다른 종목의 별칭에 밀리지 않게
  for (const ex of list) {
    const k = exerciseKey(ex.name)
    if (k && !byKey.has(k)) byKey.set(k, ex)
  }
  for (const ex of list) {
    for (const a of ex.aliases ?? []) {
      const k = exerciseKey(a)
      if (k && !byKey.has(k)) byKey.set(k, ex)
    }
  }
  return { list, byId, byKey }
}

/** 기본 종목 + 내 종목 (기본 종목 id와 겹치는 내 종목은 제외) */
export function mergeExercises(custom: Exercise[]): Exercise[] {
  return [...CATALOG, ...custom.filter((c) => c && !CATALOG_IDS.has(c.id))]
}

// 스토어 참조가 같으면 같은 결과(참조 안정성 → React memo/deps에 안전)
let memoCustom: Exercise[] | null = null
let memoIndex: ExerciseIndex = buildIndex(CATALOG)

export function exerciseIndex(custom: Exercise[] = storage.getExercises().exercises): ExerciseIndex {
  if (custom !== memoCustom) {
    memoCustom = custom
    memoIndex = buildIndex(mergeExercises(custom))
  }
  return memoIndex
}

/** 이름(또는 별칭)으로 종목 찾기 */
export function findExercise(name: string, index: ExerciseIndex = exerciseIndex()): Exercise | undefined {
  const k = exerciseKey(name)
  return k ? index.byKey.get(k) : undefined
}

/** 이미 있는 종목 id 찾기 — 알려진 exerciseId가 있으면 우선, 없으면 이름/별칭. 처음 보는 이름이면 null */
export function resolveExerciseId(
  ref: { exerciseId?: string; name: string },
  index: ExerciseIndex = exerciseIndex(),
): string | null {
  if (ref.exerciseId && index.byId.has(ref.exerciseId)) return ref.exerciseId
  return findExercise(ref.name, index)?.id ?? null
}

/** 검색어가 이름/별칭 어디에 걸렸는지 (별칭이면 그 별칭을 돌려준다) */
export function matchExercise(
  ex: Exercise,
  queryKey: string,
): { hit: boolean; alias?: string; prefix?: boolean } {
  if (!queryKey) return { hit: true }
  const nk = exerciseKey(ex.name)
  if (nk.includes(queryKey)) return { hit: true, prefix: nk.startsWith(queryKey) }
  const alias = ex.aliases?.find((a) => exerciseKey(a).includes(queryKey))
  return alias ? { hit: true, alias, prefix: exerciseKey(alias).startsWith(queryKey) } : { hit: false }
}

/** AI 요청문에 넣을 종목 이름 목록 (부위별 한 줄씩 + 내 종목) */
export function exerciseNamesForPrompt(list: Exercise[]): string {
  const lines = MUSCLE_ORDER.map((m) => {
    const names = list.filter((e) => e.builtin && e.muscle === m).map((e) => e.name)
    return names.length ? `- ${MUSCLE_LABEL[m]}: ${names.join(', ')}` : ''
  }).filter(Boolean)
  const custom = list.filter((e) => !e.builtin).map((e) => e.name)
  if (custom.length) lines.push(`- 내가 추가한 종목: ${custom.join(', ')}`)
  return lines.join('\n')
}
