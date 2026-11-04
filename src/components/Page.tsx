import type { ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import styles from './Page.module.css'

/**
 * 풀스크린 오버레이 페이지 (상세/편집/운동 화면).
 * 라우트로 렌더되어 브라우저 뒤로가기로 닫힌다.
 */
export function OverlayPage({
  children,
  variant = 'push',
}: {
  children: ReactNode
  /** push: 오른쪽에서 / modal: 아래에서 */
  variant?: 'push' | 'modal'
}) {
  return (
    <div className={`${styles.overlay} ${variant === 'modal' ? styles.modal : styles.push}`}>
      {children}
    </div>
  )
}

export function TopBar({
  title,
  subtitle,
  onBack,
  backIcon = 'back',
  backLabel,
  right,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  onBack?: () => void
  backIcon?: 'back' | 'close' | ReactNode
  backLabel?: string
  right?: ReactNode
}) {
  const icon =
    backIcon === 'back' ? (
      <ChevronLeft size={24} />
    ) : backIcon === 'close' ? (
      <X size={22} />
    ) : (
      backIcon
    )
  return (
    <header className={styles.topbar}>
      <div className={styles.side}>
        {onBack && (
          <button
            className={styles.iconBtn}
            onClick={onBack}
            aria-label={backLabel ?? (backIcon === 'close' ? '닫기' : '뒤로')}
          >
            {icon}
          </button>
        )}
      </div>
      <div className={styles.center}>
        {title && <h2 className={styles.title}>{title}</h2>}
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      <div className={`${styles.side} ${styles.sideRight}`}>{right}</div>
    </header>
  )
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${styles.body} ${className ?? ''}`}>{children}</div>
}

/** 상단바 우측의 텍스트 버튼 */
export function TopBarAction({
  children,
  onClick,
  disabled,
  tone = 'primary',
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'primary' | 'dim'
  ariaLabel?: string
}) {
  return (
    <button
      className={tone === 'primary' ? styles.action : styles.actionDim}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button className={styles.iconBtn} onClick={onClick} aria-label={label} disabled={disabled}>
      {children}
    </button>
  )
}
