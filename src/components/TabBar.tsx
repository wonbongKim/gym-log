import { useLocation, useNavigate } from 'react-router-dom'
import { House, ChartColumn, ClipboardList, type LucideIcon } from 'lucide-react'
import styles from './TabBar.module.css'

const ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: '홈', icon: House },
  { path: '/history', label: '기록', icon: ChartColumn },
  { path: '/routines', label: '루틴', icon: ClipboardList },
]

export function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className={styles.bar}>
      {ITEMS.map((it) => {
        const Icon = it.icon
        const isActive = pathname === it.path
        return (
          <button
            key={it.path}
            className={isActive ? styles.itemActive : styles.item}
            onClick={() => navigate(it.path)}
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
