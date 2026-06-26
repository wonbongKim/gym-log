import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 미지원 시 텍스트 선택으로 대체 안내
      setCopied(false)
    }
  }

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
