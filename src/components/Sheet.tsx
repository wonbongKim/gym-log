import { useEffect, type ReactNode } from 'react'
import styles from './Sheet.module.css'

/** 하단 시트 — 액션 메뉴, 확인 다이얼로그, 선택 목록에 공용 */
export function Sheet({
  title,
  description,
  onClose,
  children,
  labelledBy,
}: {
  title?: ReactNode
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className={styles.handle} aria-hidden />
        {(title || description) && (
          <div className={styles.head}>
            {title && (
              <h2 id={labelledBy} className={styles.title}>
                {title}
              </h2>
            )}
            {description && <div className={styles.desc}>{description}</div>}
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}

/** 시트 안의 액션 목록 아이템 */
export function SheetItem({
  icon,
  label,
  hint,
  danger,
  onClick,
  active,
}: {
  icon?: ReactNode
  label: ReactNode
  hint?: ReactNode
  danger?: boolean
  active?: boolean
  onClick: () => void
}) {
  const cls = [styles.item, danger ? styles.itemDanger : '', active ? styles.itemActive : '']
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} onClick={onClick}>
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemBody}>
        <span className={styles.itemLabel}>{label}</span>
        {hint && <span className={styles.itemHint}>{hint}</span>}
      </span>
    </button>
  )
}
