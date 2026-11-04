import { Minus, Plus } from 'lucide-react'
import styles from './Stepper.module.css'

/** − n + 스테퍼 (세트 수 등 작은 정수) */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`${label} 줄이기`}
      >
        <Minus size={16} />
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label} 늘리기`}
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
