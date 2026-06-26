import { useState } from 'react'
import { X, FileJson } from 'lucide-react'
import { Button } from '../components/Button'
import { uid } from '../storage'
import {
  parseRoutinesJson,
  RoutineParseError,
  SAMPLE_JSON,
} from '../lib/routineImport'
import { formatDays } from '../lib/days'
import { useExercises, useRoutines } from '../hooks/useStores'
import type { ParsedRoutine } from '../lib/routineImport'
import type { Routine } from '../types'
import styles from './RoutineEditor.module.css'
import own from './RoutineImport.module.css'

export function RoutineImport({ onClose }: { onClose: () => void }) {
  const { ensureExercise } = useExercises()
  const { upsert } = useRoutines()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedRoutine[] | null>(null)

  const handleParse = () => {
    try {
      setPreview(parseRoutinesJson(text))
      setError(null)
    } catch (e) {
      setPreview(null)
      setError(
        e instanceof RoutineParseError ? e.message : '파싱 중 오류가 발생했습니다.',
      )
    }
  }

  const handleImport = () => {
    if (!preview) return
    for (const p of preview) {
      const routine: Routine = {
        id: uid('rt'),
        name: p.name,
        days: p.days,
        exercises: p.exercises.map((e, idx) => ({
          exerciseId: ensureExercise(e.name).id,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          order: idx,
        })),
      }
      upsert(routine)
    }
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <header className={styles.topbar}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.topTitle}>JSON으로 루틴 추가</h2>
        <button
          className={styles.saveText}
          onClick={handleImport}
          disabled={!preview}
        >
          {preview && preview.length > 1 ? `${preview.length}개 추가` : '추가'}
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>JSON 붙여넣기</span>
          <textarea
            className={own.textarea}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPreview(null)
              setError(null)
            }}
            placeholder={SAMPLE_JSON}
            spellCheck={false}
          />
          <button
            className={own.sampleBtn}
            onClick={() => setText(SAMPLE_JSON)}
            type="button"
          >
            <FileJson size={16} /> 예시 채우기
          </button>
        </div>

        <Button variant="ghost" block onClick={handleParse} disabled={!text.trim()}>
          미리보기
        </Button>

        {error && <div className={own.error}>{error}</div>}

        {preview &&
          preview.map((p, pi) => (
            <div className={own.preview} key={pi}>
              <div className={own.previewDays}>{formatDays(p.days)}</div>
              <h3 className={own.previewName}>{p.name}</h3>
              <ul className={own.previewList}>
                {p.exercises.map((e, i) => (
                  <li key={i}>
                    <span>{e.name}</span>
                    <span className={own.previewMeta}>
                      {e.targetSets}세트 · {e.targetReps || '-'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        {preview && (
          <p className={own.previewHint}>
            {preview.length}개 루틴이 추가됩니다. 상단 “추가”를 누르세요.
          </p>
        )}
      </div>
    </div>
  )
}
