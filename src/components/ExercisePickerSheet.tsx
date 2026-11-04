import { useMemo, useState, type ReactNode } from 'react'
import { Dumbbell, Plus, Repeat, Search } from 'lucide-react'
import { Sheet, SheetItem } from './Sheet'
import {
  exerciseKey,
  exerciseMeta,
  findExercise,
  matchExercise,
  MUSCLE_LABEL,
  MUSCLE_ORDER,
  type ExerciseIndex,
} from '../lib/exercises'
import type { Exercise, Muscle } from '../types'
import styles from './ExercisePickerSheet.module.css'

export interface PickerSuggestion {
  title: string
  names: string[]
}

type Filter = 'all' | Muscle | 'custom'

const RECENT_LIMIT = 8

/**
 * 종목 선택 시트 (운동 중 종목 추가 / 대체 공용).
 * - 이름·별칭 검색 ("사레레" → 사이드 레터럴 레이즈), 부위별 보기, 자주 한 종목 먼저
 * - 목록에 없는 이름은 내 종목으로 새로 추가
 */
export function ExercisePickerSheet({
  title,
  description,
  index,
  excludeIds,
  suggestions = [],
  inSessionIds,
  usage,
  onPick,
  onClose,
}: {
  title: string
  description?: ReactNode
  index: ExerciseIndex
  /** 목록에서 뺄 종목 (예: 대체할 원래 종목) */
  excludeIds?: Set<string>
  suggestions?: PickerSuggestion[]
  /** 이미 이번 운동에 있는 종목 */
  inSessionIds?: Set<string>
  /** 종목 id → 지금까지 한 횟수 (자주 한 종목을 위로) */
  usage?: Map<string, number>
  onPick: (name: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const queryKey = exerciseKey(q)

  const pool = useMemo(
    () => index.list.filter((e) => !excludeIds?.has(e.id)),
    [index, excludeIds],
  )
  const order = useMemo(() => new Map(index.list.map((e, i) => [e.id, i])), [index])
  const used = (e: Exercise) => usage?.get(e.id) ?? 0
  /** 자주 한 순 → 원래(카탈로그) 순 */
  const byUsage = (a: Exercise, b: Exercise) =>
    used(b) - used(a) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)

  const hintOf = (e: Exercise, alias?: string) => {
    const parts = [
      alias ? `'${alias}'(으)로 찾음` : '',
      !index.byId.has(e.id) ? '처음 보는 종목 · 새로 추가돼요' : e.builtin ? exerciseMeta(e) : '내 종목',
      inSessionIds?.has(e.id) ? '이미 이번 운동에 있어요' : '',
    ].filter(Boolean)
    return parts.join(' · ') || undefined
  }

  const item = (e: Exercise, opts: { alias?: string; suggested?: boolean } = {}) => (
    <SheetItem
      key={e.id}
      icon={opts.suggested ? <Repeat size={18} /> : <Dumbbell size={18} />}
      label={e.name}
      hint={hintOf(e, opts.alias)}
      active={opts.suggested}
      onClick={() => onPick(e.name)}
    />
  )

  // 검색 ------------------------------------------------------------------
  const exact = queryKey ? findExercise(q, index) : undefined
  // 이름이 검색어로 시작하는 것 → 자주 한 순
  const results = queryKey
    ? pool
        .map((e) => ({ e, m: matchExercise(e, queryKey) }))
        .filter((x) => x.m.hit)
        .sort((a, b) => Number(!!b.m.prefix) - Number(!!a.m.prefix) || byUsage(a.e, b.e))
    : []

  const submit = () => {
    if (!q.trim()) return
    if (exact) return onPick(exact.name)
    if (results.length === 1) return onPick(results[0].e.name)
    if (results.length === 0) return onPick(q)
    // 후보가 여러 개면 눌러서 고르게 둔다 (엉뚱한 새 종목이 생기지 않게)
  }

  // 둘러보기 ----------------------------------------------------------------
  const muscles = MUSCLE_ORDER.filter((m) => pool.some((e) => e.muscle === m))
  const custom = pool.filter((e) => !e.builtin)
  const recent = pool
    .filter((e) => used(e) > 0)
    .sort(byUsage)
    .slice(0, RECENT_LIMIT)

  const suggestionItems = suggestions
    .map((g) => ({
      title: g.title,
      items: g.names.map((n) => findExercise(n, index) ?? { id: `name:${n}`, name: n }),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <Sheet title={title} description={description} onClose={onClose}>
      <div className={styles.top}>
        <form
          className={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Search size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="종목 검색 (예: 벤치, 사레레) 또는 새 이름"
            enterKeyHint="done"
            aria-label="종목 검색"
          />
        </form>
        {!queryKey && (
          <div className={styles.chips} role="tablist" aria-label="부위별 보기">
            {(['all', ...muscles, ...(custom.length ? ['custom' as const] : [])] as Filter[]).map(
              (f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  className={filter === f ? styles.chipOn : styles.chip}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '전체' : f === 'custom' ? '내 종목' : MUSCLE_LABEL[f]}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {queryKey ? (
        <>
          {results.map(({ e, m }) => item(e, { alias: m.alias }))}
          {!exact && (
            <SheetItem
              icon={<Plus size={18} />}
              label={`'${q.trim()}' 새 종목으로 추가`}
              hint="목록에 없는 운동이면 내 종목으로 등록돼요"
              onClick={() => onPick(q)}
            />
          )}
        </>
      ) : filter === 'all' ? (
        <>
          {suggestionItems.map((g) => (
            <section key={g.title} className={styles.group}>
              <p className={styles.groupTitle}>{g.title}</p>
              {g.items.map((e) => item(e, { suggested: true }))}
            </section>
          ))}
          {recent.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupTitle}>자주 한 종목</p>
              {recent.map((e) => item(e))}
            </section>
          )}
          {muscles.map((m) => (
            <section key={m} className={styles.group}>
              <p className={styles.groupTitle}>{MUSCLE_LABEL[m]}</p>
              {pool
                .filter((e) => e.muscle === m)
                .map((e) => item(e))}
            </section>
          ))}
          {custom.some((e) => !e.muscle) && (
            <section className={styles.group}>
              <p className={styles.groupTitle}>내 종목</p>
              {custom.filter((e) => !e.muscle).map((e) => item(e))}
            </section>
          )}
        </>
      ) : (
        <section className={styles.group}>
          {pool
            .filter((e) => (filter === 'custom' ? !e.builtin : e.muscle === filter))
            .sort(byUsage)
            .map((e) => item(e))}
        </section>
      )}
    </Sheet>
  )
}
