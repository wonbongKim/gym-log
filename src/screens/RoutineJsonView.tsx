import { useRef, useState } from 'react'
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
  const taRef = useRef<HTMLTextAreaElement>(null)

  /** 권한이 막힌 환경(in-app 브라우저 등)을 위한 execCommand 폴백 */
  const fallbackCopy = (): boolean => {
    const ta = taRef.current
    if (!ta) return false
    ta.focus()
    ta.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      ta.setSelectionRange(0, 0)
      ta.blur()
    }
  }

  const handleCopy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(json)
      ok = true
    } catch {
      ok = fallbackCopy()
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      // 둘 다 실패: 사용자가 직접 복사하도록 전체 선택만 해둔다
      taRef.current?.select()
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
          ref={taRef}
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
