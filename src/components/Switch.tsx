import type { ReactNode } from 'react'
import styles from './Switch.module.css'

/** 라벨 + 토글 스위치 한 줄 */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  icon,
}: {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.body}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <span className={checked ? styles.trackOn : styles.track} aria-hidden>
        <span className={styles.thumb} />
      </span>
    </button>
  )
}
