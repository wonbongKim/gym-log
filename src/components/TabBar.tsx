import { useLocation, useNavigate } from 'react-router-dom'
import { House, ChartColumn, ClipboardList, type LucideIcon } from 'lucide-react'
import { useSession } from '../hooks/useStores'
import styles from './TabBar.module.css'

const ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: '홈', icon: House },
  { path: '/history', label: '기록', icon: ChartColumn },
  { path: '/routines', label: '루틴', icon: ClipboardList },
]

function isActivePath(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path)
}

export function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session } = useSession()

  return (
    <nav className={styles.bar} aria-label="주요 메뉴">
      {ITEMS.map((it) => {
        const Icon = it.icon
        const isActive = isActivePath(pathname, it.path)
        return (
          <button
            key={it.path}
            className={isActive ? styles.itemActive : styles.item}
            onClick={() => {
              if (pathname !== it.path) navigate(it.path)
              else window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
              {/* 진행 중 운동이 있으면 홈 탭에 점 표시 */}
              {it.path === '/' && session && <span className={styles.dot} aria-label="진행 중인 운동" />}
            </span>
            <span className={styles.label}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
