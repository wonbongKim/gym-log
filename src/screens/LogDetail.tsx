import { X, Check } from 'lucide-react'
import { logStats } from '../lib/workout'
import type { WorkoutLog } from '../types'
import editor from './RoutineEditor.module.css'
import styles from './LogDetail.module.css'

export function LogDetail({
  log,
  onClose,
}: {
  log: WorkoutLog
  onClose: () => void
}) {
  const { totalSets, totalVolume } = logStats(log.exercises)

  return (
    <div className={editor.overlay}>
      <header className={editor.topbar}>
        <button className={editor.iconBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={editor.topTitle}>{log.date}</h2>
        <span style={{ minWidth: 48 }} />
      </header>

      <div className={editor.body}>
        <div className={styles.summary}>
          <h3 className={styles.routineName}>{log.routineName}</h3>
          <div className={styles.stats}>
            <span>{log.exercises.length}종목</span>
            <span>{totalSets}세트</span>
            {totalVolume > 0 && (
              <span>총 {totalVolume.toLocaleString()}kg</span>
            )}
          </div>
        </div>

        {log.exercises.map((ex, i) => (
          <section key={ex.exerciseId + i} className={styles.exCard}>
            <div className={styles.exHead}>
              <h4>{ex.exerciseName}</h4>
              {ex.done && <Check size={16} className={styles.doneIcon} />}
            </div>
            <table className={styles.setTable}>
              <tbody>
                {ex.sets.map((s, si) => (
                  <tr key={si}>
                    <td className={styles.setNo}>{s.setNo}세트</td>
                    <td className={styles.setKg}>
                      {s.kg == null ? '맨몸' : `${s.kg} kg`}
                    </td>
                    <td className={styles.setReps}>{s.reps} 회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}
