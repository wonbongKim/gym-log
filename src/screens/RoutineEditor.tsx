import { useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Trash2,
  ChevronDown,
  Repeat2,
  MessageSquareText,
} from 'lucide-react'
import { Button } from '../components/Button'
import { Stepper } from '../components/Stepper'
import { OverlayPage, PageBody, TopBar, TopBarAction } from '../components/Page'
import { useDialog } from '../components/DialogProvider'
import { WEEK_DAYS } from '../lib/days'
import { normalizeAlternatives } from '../lib/routineImport'
import { exerciseKey, exerciseMeta, findExercise } from '../lib/exercises'
import { uid } from '../storage'
import type { Routine, WeekDay } from '../types'
import { useExercises, useRoutines } from '../hooks/useStores'
import { useGoBack } from '../hooks/useGoBack'
import { useDeleteRoutine } from '../hooks/useDeleteRoutine'
import styles from './RoutineEditor.module.css'

interface DraftRow {
  key: string
  name: string
  targetSets: number
  targetReps: string
  /** 대체 종목 — 쉼표로 구분한 입력 그대로 */
  alternatives: string
  note: string
  /** 대체 종목·메모 영역 펼침 (비교 대상 아님) */
  extraOpen: boolean
}

function emptyRow(): DraftRow {
  return {
    key: uid('row'),
    name: '',
    targetSets: 3,
    targetReps: '8~12',
    alternatives: '',
    note: '',
    extraOpen: false,
  }
}

function toDraftRows(routine: Routine | null, nameOf: (id: string) => string): DraftRow[] {
  if (!routine) return []
  return [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const alternatives = (e.alternatives ?? []).join(', ')
      const note = e.note ?? ''
      return {
        key: uid('row'),
        name: nameOf(e.exerciseId),
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        alternatives,
        note,
        // 값이 있으면 펼친 상태로 시작
        extraOpen: alternatives.trim().length > 0 || note.trim().length > 0,
      }
    })
}

/** 비교용 직렬화 (key 제외) */
function snapshot(name: string, days: WeekDay[], rows: DraftRow[]): string {
  return JSON.stringify({
    name: name.trim(),
    days: [...days].sort(),
    rows: rows.map((r) => [
      r.name.trim(),
      r.targetSets,
      r.targetReps.trim(),
      normalizeAlternatives(r.alternatives, r.name),
      r.note.trim(),
    ]),
  })
}

export function RoutineEditor({ routine }: { routine: Routine | null }) {
  const { exercises, index, ensureExercise } = useExercises()
  const { upsert } = useRoutines()
  const { confirm, toast } = useDialog()
  const goBack = useGoBack('/routines')
  const deleteRoutine = useDeleteRoutine()
  const listEnd = useRef<HTMLDivElement>(null)

  const nameOf = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]))
    return (id: string) => map.get(id) ?? ''
  }, [exercises])

  const [name, setName] = useState(routine?.name ?? '')
  const [days, setDays] = useState<WeekDay[]>(routine?.days ?? [])
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(routine, nameOf))
  const [initial] = useState(() => snapshot(name, days, rows))
  const dirty = snapshot(name, days, rows) !== initial
  /** 대체 종목 입력 중인 행 — 그 행 기준으로 자동완성 후보를 만든다 */
  const [altFocus, setAltFocus] = useState<string | null>(null)

  // 쉼표로 여러 개를 적는 칸이라, 마지막 쉼표 앞부분을 붙인 값으로 datalist 후보를 만든다
  const altSuggestions = useMemo(() => {
    const row = rows.find((r) => r.key === altFocus)
    if (!row) return []
    const cut = Math.max(row.alternatives.lastIndexOf(','), row.alternatives.lastIndexOf('，'))
    const prefix = cut >= 0 ? `${row.alternatives.slice(0, cut + 1).trimEnd()} ` : ''
    const used = new Set(normalizeAlternatives(prefix).map(exerciseKey))
    used.add(exerciseKey(row.name))
    return exercises.filter((e) => !used.has(exerciseKey(e.name))).map((e) => prefix + e.name)
  }, [rows, altFocus, exercises])

  /** 입력한 이름이 어떤 종목으로 저장되는지 (별칭 연결 / 처음 보는 종목 / 부위·기구) */
  const nameHint = (raw: string): { text: string; isNew: boolean } | null => {
    const n = raw.trim()
    if (!n) return null
    const hit = findExercise(n, index)
    if (!hit) return { text: '처음 보는 종목 · 저장하면 내 종목으로 추가돼요', isNew: true }
    const meta = exerciseMeta(hit)
    if (exerciseKey(hit.name) !== exerciseKey(n)) {
      return { text: `→ '${hit.name}'(으)로 저장돼요${meta ? ` · ${meta}` : ''}`, isNew: false }
    }
    return meta ? { text: meta, isNew: false } : null
  }

  const toggleDay = (d: WeekDay) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()])
    // 새 행으로 스크롤 + 이름 입력 포커스
    requestAnimationFrame(() => {
      listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-row-name]')
      inputs[inputs.length - 1]?.focus()
    })
  }

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  const moveRow = (key: string, dir: -1 | 1) =>
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const missing: string[] = []
  if (!name.trim()) missing.push('루틴 이름')
  if (days.length === 0) missing.push('요일')
  if (!rows.some((r) => r.name.trim())) missing.push('종목 1개 이상')
  const canSave = missing.length === 0

  const handleSave = () => {
    if (!canSave) return
    const validRows = rows.filter((r) => r.name.trim().length > 0)
    const built: Routine = {
      id: routine?.id ?? uid('rt'),
      name: name.trim(),
      days,
      exercises: validRows.map((r, idx) => {
        const alternatives = normalizeAlternatives(r.alternatives, r.name)
        const note = r.note.trim()
        return {
          exerciseId: ensureExercise(r.name).id,
          targetSets: r.targetSets,
          targetReps: r.targetReps.trim(),
          order: idx,
          ...(note ? { note } : {}),
          ...(alternatives.length > 0 ? { alternatives } : {}),
        }
      }),
    }
    upsert(built)
    goBack()
    toast(routine ? '루틴을 저장했어요' : '새 루틴을 만들었어요', { type: 'success' })
  }

  const handleClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: '변경 사항을 버릴까요?',
        message: '저장하지 않은 내용은 사라져요.',
        confirmText: '버리고 나가기',
        cancelText: '계속 편집',
        danger: true,
      })
      if (!ok) return
    }
    goBack()
  }

  const handleDelete = async () => {
    if (!routine) return
    if (await deleteRoutine(routine)) goBack()
  }

  return (
    <OverlayPage variant="modal">
      <TopBar
        onBack={handleClose}
        backIcon="close"
        title={routine ? '루틴 수정' : '새 루틴'}
        right={
          <TopBarAction onClick={handleSave} disabled={!canSave}>
            저장
          </TopBarAction>
        }
      />

      <PageBody className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>루틴 이름</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 월요일 - 가슴/등/삼두"
            autoFocus={!routine}
            enterKeyHint="next"
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>요일</span>
          <div className={styles.days} role="group" aria-label="요일 선택">
            {WEEK_DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={days.includes(d.id)}
                className={days.includes(d.id) ? styles.dayOn : styles.day}
                onClick={() => toggleDay(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            운동 종목 <span className={styles.count}>{rows.length}</span>
          </span>

          {rows.length === 0 && (
            <p className={styles.rowsEmpty}>아래 버튼으로 종목을 추가하세요.</p>
          )}

          {rows.map((r, idx) => {
            const altCount = normalizeAlternatives(r.alternatives, r.name).length
            const hasNote = r.note.trim().length > 0
            const extraId = `row-extra-${r.key}`
            const hint = nameHint(r.name)
            return (
              <div key={r.key} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.rowNo}>{idx + 1}</span>
                  <input
                    data-row-name
                    className={styles.rowName}
                    list="exercise-names"
                    value={r.name}
                    onChange={(e) => updateRow(r.key, { name: e.target.value })}
                    placeholder="종목명 (예: 벤치프레스)"
                    enterKeyHint="next"
                  />
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => removeRow(r.key)}
                    aria-label={`${idx + 1}번 종목 삭제`}
                  >
                    <X size={18} />
                  </button>
                </div>
                {hint && (
                  <p className={hint.isNew ? `${styles.nameHint} ${styles.nameHintNew}` : styles.nameHint}>
                    {hint.text}
                  </p>
                )}
                <div className={styles.rowNums}>
                  <div className={styles.numField}>
                    <span>세트</span>
                    <Stepper
                      label="세트 수"
                      value={r.targetSets}
                      onChange={(v) => updateRow(r.key, { targetSets: v })}
                    />
                  </div>
                  <label className={styles.numField}>
                    <span>목표 횟수</span>
                    <input
                      className={styles.numInput}
                      value={r.targetReps}
                      onChange={(e) => updateRow(r.key, { targetReps: e.target.value })}
                      placeholder="8~12"
                    />
                  </label>
                  <div className={styles.moveBtns}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => moveRow(r.key, -1)}
                      disabled={idx === 0}
                      aria-label="위로"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => moveRow(r.key, 1)}
                      disabled={idx === rows.length - 1}
                      aria-label="아래로"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.extraToggle}
                  aria-expanded={r.extraOpen}
                  aria-controls={extraId}
                  onClick={() => updateRow(r.key, { extraOpen: !r.extraOpen })}
                >
                  <span className={styles.extraLabel}>대체 종목·메모</span>
                  {!r.extraOpen && (altCount > 0 || hasNote) && (
                    <span className={styles.extraBadges}>
                      {altCount > 0 && (
                        <span className={styles.extraBadge}>
                          <Repeat2 size={12} aria-hidden /> 대체 {altCount}
                        </span>
                      )}
                      {hasNote && (
                        <span className={styles.extraBadge}>
                          <MessageSquareText size={12} aria-hidden /> 메모
                        </span>
                      )}
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={r.extraOpen ? `${styles.chev} ${styles.chevOpen}` : styles.chev}
                    aria-hidden
                  />
                </button>

                {r.extraOpen && (
                  <div id={extraId} className={styles.extra}>
                    <label className={styles.numField}>
                      <span>대체 종목 · 기구가 사용 중일 때 (쉼표로 구분)</span>
                      <input
                        className={styles.extraInput}
                        list="alt-exercise-names"
                        value={r.alternatives}
                        onFocus={() => setAltFocus(r.key)}
                        onChange={(e) => updateRow(r.key, { alternatives: e.target.value })}
                        placeholder="예: 덤벨 벤치프레스, 머신 체스트프레스"
                        enterKeyHint="next"
                      />
                    </label>
                    <label className={styles.numField}>
                      <span>메모 · 수행 팁</span>
                      <input
                        className={styles.extraInput}
                        value={r.note}
                        onChange={(e) => updateRow(r.key, { note: e.target.value })}
                        placeholder="예: 템포 3-1-1, 무릎 아프면 가동범위 줄이기"
                        enterKeyHint="next"
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}

          <datalist id="exercise-names">
            {exercises.map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
          <datalist id="alt-exercise-names">
            {altSuggestions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <div ref={listEnd}>
            <Button variant="outline" block onClick={addRow}>
              <Plus size={18} /> 종목 추가
            </Button>
          </div>
        </div>

        {!canSave && (dirty || routine) && (
          <p className={styles.missing}>저장하려면 {missing.join(', ')}이(가) 필요해요.</p>
        )}

        {routine && (
          <Button variant="danger" block onClick={handleDelete}>
            <Trash2 size={18} /> 루틴 삭제
          </Button>
        )}
      </PageBody>
    </OverlayPage>
  )
}
