import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Dumbbell, Braces, Code } from 'lucide-react'
import { Button } from '../components/Button'
import { formatDays } from '../lib/days'
import { useExercises, useRoutines } from '../hooks/useStores'
import { routineToImportJson, routinesToImportJson } from '../lib/routineExport'
import type { Routine } from '../types'
import { RoutineEditor } from './RoutineEditor'
import { RoutineImport } from './RoutineImport'
import { RoutineJsonView } from './RoutineJsonView'
import styles from './Screen.module.css'
import list from './RoutinesScreen.module.css'

export function RoutinesScreen() {
  const { routines, remove } = useRoutines()
  const { exercises } = useExercises()
  const [editing, setEditing] = useState<Routine | null | undefined>(undefined)
  // undefined = 닫힘, null = 새로 추가, Routine = 수정
  const [importing, setImporting] = useState(false)
  const [viewing, setViewing] = useState<{ json: string; title: string } | null>(
    null,
  )

  const nameOf = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]))
    return (id: string) => map.get(id) ?? ''
  }, [exercises])

  const handleDelete = (r: Routine) => {
    if (confirm(`'${r.name}' 루틴을 삭제할까요?\n(과거 운동 기록은 보존됩니다)`)) {
      remove(r.id)
    }
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>루틴</h1>
      </header>

      {routines.length === 0 ? (
        <div className={styles.placeholder}>
          아직 루틴이 없어요.
          <br />
          아래 버튼으로 첫 루틴을 만들어 보세요.
        </div>
      ) : (
        <ul className={list.list}>
          {routines.map((r) => (
            <li key={r.id} className={list.card}>
              <div className={list.cardMain}>
                <div className={list.cardTop}>
                  <span className={list.days}>{formatDays(r.days)}</span>
                </div>
                <h2 className={list.name}>{r.name}</h2>
                <p className={list.meta}>
                  <Dumbbell size={14} /> {r.exercises.length}개 종목
                </p>
              </div>
              <div className={list.cardActions}>
                <button
                  className={list.iconBtn}
                  onClick={() =>
                    setViewing({
                      json: routineToImportJson(r, nameOf),
                      title: 'JSON 보기',
                    })
                  }
                  aria-label="JSON 보기"
                >
                  <Code size={18} />
                </button>
                <button
                  className={list.iconBtn}
                  onClick={() => setEditing(r)}
                  aria-label="수정"
                >
                  <Pencil size={18} />
                </button>
                <button
                  className={list.iconBtn}
                  onClick={() => handleDelete(r)}
                  aria-label="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={list.addWrap}>
        <Button block onClick={() => setEditing(null)}>
          <Plus size={18} /> 루틴 추가
        </Button>
        <Button variant="ghost" block onClick={() => setImporting(true)}>
          <Braces size={18} /> JSON으로 추가
        </Button>
        {routines.length > 0 && (
          <Button
            variant="ghost"
            block
            onClick={() =>
              setViewing({
                json: routinesToImportJson(routines, nameOf),
                title: `전체 루틴 JSON (${routines.length}개)`,
              })
            }
          >
            <Code size={18} /> 전체 JSON 보기
          </Button>
        )}
      </div>

      {editing !== undefined && (
        <RoutineEditor routine={editing} onClose={() => setEditing(undefined)} />
      )}
      {importing && <RoutineImport onClose={() => setImporting(false)} />}
      {viewing && (
        <RoutineJsonView
          json={viewing.json}
          title={viewing.title}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  )
}
