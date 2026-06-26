import { X, Copy, Check } from 'lucide-react'
import { useClipboard } from '../hooks/useClipboard'
import styles from './RoutineEditor.module.css'
import own from './RoutineImport.module.css'

export function RoutineJsonView({
  json,
  title,
  onClose,
}: {
  json: string
  title: string
  onClose: () => void
}) {
  const { copied, copy } = useClipboard()

  const handleCopy = () => copy(json)

  return (
    <div className={styles.overlay}>
      <header className={styles.topbar}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.topTitle}>{title}</h2>
        <button className={styles.saveText} onClick={handleCopy}>
          {copied ? (
            <>
              <Check size={16} /> 복사됨
            </>
          ) : (
            <>
              <Copy size={16} /> 복사
            </>
          )}
        </button>
      </header>

      <div className={styles.body}>
        <textarea
          className={own.textarea}
          value={json}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          style={{ minHeight: '60vh' }}
        />
      </div>
    </div>
  )
}
