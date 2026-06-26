import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Trash2, Check, Dumbbell } from 'lucide-react'
import { Button } from '../components/Button'
import { useLogs, useSession } from '../hooks/useStores'
import { sessionToLog, summarizeSets } from '../lib/workout'
import type { SetRecord, WorkoutSession } from '../types'
import editor from './RoutineEditor.module.css'
import styles from './WorkoutScreen.module.css'

export function WorkoutScreen() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const { addLog, lastRecordOf } = useLogs()

  // 종목별 직전 기록 (세션 동안 고정)
  const prevById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof lastRecordOf>>()
    session?.exercises.forEach((e) => {
      if (!map.has(e.exerciseId)) map.set(e.exerciseId, lastRecordOf(e.exerciseId))
    })
    return map
    // 세션 종목 구성이 바뀔 때만 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.routineId])

  if (!session) return null

  const patch = (mutate: (s: WorkoutSession) => void) => {
    const next = structuredClone(session)
    mutate(next)
    setSession(next)
  }

  const updateSet = (exIdx: number, setIdx: number, p: Partial<SetRecord>) =>
    patch((s) => {
      s.exercises[exIdx].sets[setIdx] = {
        ...s.exercises[exIdx].sets[setIdx],
        ...p,
      }
    })

  const addSet = (exIdx: number) =>
    patch((s) => {
      const sets = s.exercises[exIdx].sets
      const last = sets[sets.length - 1]
      sets.push({
        setNo: sets.length + 1,
        kg: last ? last.kg : null,
        reps: last ? last.reps : 0,
      })
    })

  const removeSet = (exIdx: number, setIdx: number) =>
    patch((s) => {
      s.exercises[exIdx].sets.splice(setIdx, 1)
      s.exercises[exIdx].sets.forEach((set, i) => (set.setNo = i + 1))
    })

  const toggleDone = (exIdx: number) =>
    patch((s) => {
      s.exercises[exIdx].done = !s.exercises[exIdx].done
    })

  const doneCount = session.exercises.filter((e) => e.done).length

  const handleFinish = () => {
    if (!confirm('운동을 종료하고 기록을 저장할까요?')) return
    addLog(sessionToLog(session))
    setSession(null)
    navigate('/', { replace: true })
  }

  const handleCancel = () => {
    if (!confirm('운동을 취소할까요?\n입력한 기록이 저장되지 않습니다.')) return
    setSession(null)
    navigate('/', { replace: true })
  }

  // 진행 내용은 세트 입력 시 이미 저장돼 있으므로, 최소화는 운동 화면만 벗어난다
  const handleMinimize = () => navigate(-1)

  return (
    <div className={editor.overlay}>
      <header className={editor.topbar}>
        <button
          className={editor.iconBtn}
          onClick={handleMinimize}
          aria-label="최소화"
        >
          <ChevronDown size={22} />
        </button>
        <div className={styles.topInfo}>
          <span className={styles.topName}>{session.routineName}</span>
          <span className={styles.topMeta}>
            {doneCount}/{session.exercises.length} 완료
          </span>
        </div>
        <button className={editor.saveText} onClick={handleFinish}>
          종료
        </button>
      </header>

      <div className={editor.body}>
        {session.exercises.map((ex, exIdx) => {
          const prev = prevById.get(ex.exerciseId)
          return (
            <section
              key={ex.exerciseId + exIdx}
              className={ex.done ? styles.cardDone : styles.card}
            >
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>
                  <Dumbbell size={16} />
                  <h3>{ex.exerciseName}</h3>
                </div>
                <button
                  className={ex.done ? styles.doneOn : styles.doneBtn}
                  onClick={() => toggleDone(exIdx)}
                  aria-label="완료"
                >
                  <Check size={16} /> {ex.done ? '완료됨' : '완료'}
                </button>
              </div>

              <p className={styles.prev}>
                {prev
                  ? `지난번(${prev.date.slice(5)}): ${summarizeSets(prev.sets)}`
                  : '첫 기록이에요 💪'}
              </p>

              <div className={styles.sets}>
                <div className={styles.setHeadRow}>
                  <span className={styles.colNo}>세트</span>
                  <span className={styles.colNum}>kg</span>
                  <span className={styles.colNum}>횟수</span>
                  <span className={styles.colDel} />
                </div>
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className={styles.setRow}>
                    <span className={styles.colNo}>{set.setNo}</span>
                    <input
                      className={styles.numInput}
                      inputMode="decimal"
                      placeholder="0 kg"
                      value={set.kg == null ? '' : set.kg}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        updateSet(exIdx, setIdx, {
                          kg: v === '' ? null : Number(v),
                        })
                      }}
                    />
                    <input
                      className={styles.numInput}
                      inputMode="numeric"
                      placeholder="0 회"
                      value={set.reps === 0 ? '' : set.reps}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        updateSet(exIdx, setIdx, {
                          reps: v === '' ? 0 : Math.max(0, Number(v) || 0),
                        })
                      }}
                    />
                    <button
                      className={styles.delBtn}
                      onClick={() => removeSet(exIdx, setIdx)}
                      disabled={ex.sets.length <= 1}
                      aria-label="세트 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button className={styles.addSet} onClick={() => addSet(exIdx)}>
                <Plus size={16} /> 세트 추가
              </button>
            </section>
          )
        })}

        <Button block onClick={handleFinish}>
          <Check size={18} /> 운동 종료 · 기록 저장
        </Button>
        <button className={styles.cancelLink} onClick={handleCancel}>
          운동 취소(저장 안 함)
        </button>
      </div>
    </div>
  )
}
