import { useCallback, useState } from 'react'

/** 권한이 막힌 환경(인앱 브라우저 등)을 위한 execCommand 폴백 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

/** 텍스트를 클립보드로 복사하고, 잠시 'copied' 상태를 true로 둔다 */
export function useClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok = false
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        ok = fallbackCopy(text)
      }
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), resetMs)
      }
      return ok
    },
    [resetMs],
  )

  return { copied, copy }
}
