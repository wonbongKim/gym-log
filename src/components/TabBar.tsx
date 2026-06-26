import { House, ChartColumn, ClipboardList, type LucideIcon } from 'lucide-react'
import styles from './TabBar.module.css'

export type Tab = 'home' | 'history' | 'routines'

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: '홈', icon: House },
  { id: 'history', label: '기록', icon: ChartColumn },
  { id: 'routines', label: '루틴', icon: ClipboardList },
]

export function TabBar({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <nav className={styles.bar}>
      {ITEMS.map((it) => {
        const Icon = it.icon
        const isActive = active === it.id
        return (
          <button
            key={it.id}
            className={isActive ? styles.itemActive : styles.item}
            onClick={() => onChange(it.id)}
            aria-current={isActive}
          >
            <Icon
              className={styles.icon}
              size={24}
              strokeWidth={isActive ? 2.4 : 2}
              aria-hidden
            />
            <span className={styles.label}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
