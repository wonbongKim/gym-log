import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus, X } from 'lucide-react'
import { Button } from '../components/Button'
import { WEEK_DAYS } from '../lib/days'
import { uid } from '../storage'
import type { Routine, WeekDay } from '../types'
import { useExercises, useRoutines } from '../hooks/useStores'
import styles from './RoutineEditor.module.css'

interface DraftRow {
  key: string
  name: string
  targetSets: number
  targetReps: string
}

function toDraftRows(
  routine: Routine | null,
  nameOf: (id: string) => string,
): DraftRow[] {
  if (!routine) return []
  return [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .map((e) => ({
      key: uid('row'),
      name: nameOf(e.exerciseId),
      targetSets: e.targetSets,
      targetReps: e.targetReps,
    }))
}

export function RoutineEditor({
  routine,
  onClose,
}: {
  routine: Routine | null
  onClose: () => void
}) {
  const { exercises, ensureExercise } = useExercises()
  const { upsert } = useRoutines()

  const nameOf = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]))
    return (id: string) => map.get(id) ?? ''
  }, [exercises])

  const [name, setName] = useState(routine?.name ?? '')
  const [days, setDays] = useState<WeekDay[]>(routine?.days ?? [])
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(routine, nameOf))

  const toggleDay = (d: WeekDay) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    )

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { key: uid('row'), name: '', targetSets: 3, targetReps: '8~12' },
    ])

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key))

  const moveRow = (key: string, dir: -1 | 1) =>
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const canSave =
    name.trim().length > 0 &&
    days.length > 0 &&
    rows.some((r) => r.name.trim().length > 0)

  const handleSave = () => {
    const validRows = rows.filter((r) => r.name.trim().length > 0)
    const built: Routine = {
      id: routine?.id ?? uid('rt'),
      name: name.trim(),
      days,
      exercises: validRows.map((r, idx) => ({
        exerciseId: ensureExercise(r.name).id,
        targetSets: r.targetSets,
        targetReps: r.targetReps.trim(),
        order: idx,
      })),
    }
    upsert(built)
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <header className={styles.topbar}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.topTitle}>
          {routine ? '루틴 수정' : '루틴 추가'}
        </h2>
        <button
          className={styles.saveText}
          onClick={handleSave}
          disabled={!canSave}
        >
          저장
        </button>
      </header>

      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>루틴 이름</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 월요일 - 가슴/등/삼두"
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>요일</span>
          <div className={styles.days}>
            {WEEK_DAYS.map((d) => (
              <button
                key={d.id}
                className={days.includes(d.id) ? styles.dayOn : styles.day}
                onClick={() => toggleDay(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>운동 종목</span>
          {rows.map((r, idx) => (
            <div key={r.key} className={styles.row}>
              <div className={styles.rowMain}>
                <input
                  className={styles.input}
                  list="exercise-names"
                  value={r.name}
                  onChange={(e) => updateRow(r.key, { name: e.target.value })}
                  placeholder="종목명 (예: 벤치프레스)"
                />
                <div className={styles.rowNums}>
                  <label className={styles.numField}>
                    <span>세트</span>
                    <input
                      className={styles.numInput}
                      type="number"
                      min={1}
                      value={r.targetSets}
                      onChange={(e) =>
                        updateRow(r.key, {
                          targetSets: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className={styles.numField}>
                    <span>횟수</span>
                    <input
                      className={styles.numInput}
                      value={r.targetReps}
                      onChange={(e) =>
                        updateRow(r.key, { targetReps: e.target.value })
                      }
                      placeholder="8~12"
                    />
                  </label>
                </div>
              </div>
              <div className={styles.rowActions}>
                <button
                  className={styles.iconBtn}
                  onClick={() => moveRow(r.key, -1)}
                  disabled={idx === 0}
                  aria-label="위로"
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => moveRow(r.key, 1)}
                  disabled={idx === rows.length - 1}
                  aria-label="아래로"
                >
                  <ArrowDown size={18} />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => removeRow(r.key)}
                  aria-label="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          <datalist id="exercise-names">
            {exercises.map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>

          <Button variant="ghost" block onClick={addRow}>
            <Plus size={18} /> 종목 추가
          </Button>
        </div>
      </div>
    </div>
  )
}
