import { useState, type InputHTMLAttributes } from 'react'

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

const DECIMAL = /^-?\d*([.,]\d*)?$/
const INTEGER = /^\d*$/

/**
 * 숫자 입력 — 편집 중엔 문자열 draft를 유지해 "80." / "-" 같은 중간 상태를 살린다.
 * (Number()로 바로 바꾸면 소수점이 사라져 2.5kg 같은 값을 칠 수 없음)
 */
export function NumInput({
  value,
  onValueChange,
  decimal = false,
  emptyValue,
  ...rest
}: Base & {
  value: number | null
  onValueChange: (v: number | null) => void
  /** 소수/음수 허용 (kg) */
  decimal?: boolean
  /** 이 값이면 빈 칸으로 표시 (예: reps 0) */
  emptyValue?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown =
    draft ?? (value == null || value === emptyValue ? '' : String(value))

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      enterKeyHint="next"
      value={shown}
      onFocus={(e) => {
        // 탭 한 번으로 바로 덮어쓰기
        const el = e.currentTarget
        requestAnimationFrame(() => el.select())
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        setDraft(null)
        rest.onBlur?.(e)
      }}
      onChange={(e) => {
        const raw = e.target.value.trim()
        if (!(decimal ? DECIMAL : INTEGER).test(raw)) return
        setDraft(raw)
        if (raw === '') {
          onValueChange(null)
          return
        }
        const n = Number(raw.replace(',', '.'))
        if (Number.isFinite(n)) onValueChange(n)
      }}
    />
  )
}
