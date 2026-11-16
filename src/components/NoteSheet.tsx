import { useState } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'
import styles from './NoteSheet.module.css'

export const SET_NOTE_PRESETS = [
  '가동범위 부족',
  '마지막 회 하프',
  '중간에 멈춤',
  '보조 받음',
  '자세 무너짐',
  '통증',
  '여유 있음',
]

export const EXERCISE_NOTE_PRESETS = [
  '무릎 불편',
  '어깨 불편',
  '허리 불편',
  '기구 변경',
  '컨디션 좋음',
  '컨디션 나쁨',
  '다음엔 증량',
]

/** 오늘 운동 전체 메모 */
export const WORKOUT_NOTE_PRESETS = [
  '다른 헬스장',
  '컨디션 저하',
  '수면 부족',
  '시간 부족',
  '일부 종목 생략',
  '근육통 남음',
  '통증 있음',
  '컨디션 좋음',
]

/** 문자열 메모 안에서 프리셋 문구를 토글 (", "로 구분) */
function togglePhrase(note: string, phrase: string): string {
  const parts = note
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  const idx = parts.indexOf(phrase)
  if (idx >= 0) parts.splice(idx, 1)
  else parts.push(phrase)
  return parts.join(', ')
}

/** 메모 입력 시트 — 빠른 태그 + 자유 입력 */
export function NoteSheet({
  title,
  description,
  value,
  presets,
  placeholder,
  rows = 3,
  maxLength = 300,
  onSave,
  onClose,
}: {
  title: string
  description?: string
  value: string
  presets: string[]
  placeholder?: string
  rows?: number
  maxLength?: number
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState(value)
  const has = (p: string) => note.split(/\s*,\s*/).includes(p)

  return (
    <Sheet title={title} description={description} onClose={onClose}>
      <div className={styles.chips} role="group" aria-label="빠른 메모">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={has(p)}
            className={has(p) ? styles.chipOn : styles.chip}
            onClick={() => setNote((n) => togglePhrase(n, p))}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        className={styles.textarea}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder ?? '자유롭게 적어 주세요'}
        rows={rows}
        maxLength={maxLength}
      />
      <div className={styles.actions}>
        {value && (
          <Button
            variant="danger"
            onClick={() => {
              onSave('')
              onClose()
            }}
          >
            지우기
          </Button>
        )}
        <Button
          block
          onClick={() => {
            onSave(note.trim())
            onClose()
          }}
        >
          저장
        </Button>
      </div>
    </Sheet>
  )
}

/** 오늘 운동 전체 메모 시트 (운동 중 · 기록 상세 공용) */
export function WorkoutNoteSheet({
  value,
  onSave,
  onClose,
}: {
  value: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  return (
    <NoteSheet
      title="오늘 운동 메모"
      description="헬스장·컨디션·시간 등 오늘 운동 전체에 대한 메모예요. 기록과 AI 내보내기에 함께 남아요."
      value={value}
      presets={WORKOUT_NOTE_PRESETS}
      placeholder="예: 회사 근처 헬스장이라 기구가 달랐음, 4시간 자서 전체적으로 무게 낮춤, 시간 없어서 팔 운동 뺌"
      rows={4}
      maxLength={500}
      onSave={onSave}
      onClose={onClose}
    />
  )
}
