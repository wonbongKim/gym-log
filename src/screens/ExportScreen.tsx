import { useMemo, useState } from 'react'
import { Copy, Share2, Download, Sparkles, ShieldCheck } from 'lucide-react'
import { Button } from '../components/Button'
import { OverlayPage, PageBody, TopBar } from '../components/Page'
import { Segmented } from '../components/Segmented'
import { SwitchRow } from '../components/Switch'
import { useDialog } from '../components/DialogProvider'
import { useClipboard } from '../hooks/useClipboard'
import { useGoBack } from '../hooks/useGoBack'
import { useExerciseNameOf, useLogs, useRoutines } from '../hooks/useStores'
import {
  analysisPrompt,
  approxKB,
  buildAiExport,
  buildRawExport,
  compactJson,
  PERIOD_LABEL,
  periodFrom,
  type Period,
} from '../lib/aiExport'
import { downloadText } from '../lib/backup'
import { localDate } from '../lib/stats'
import styles from './Screen.module.css'
import own from './ExportScreen.module.css'

type Format = 'ai' | 'raw'

/** 기간별 내보내기 — AI에 직접 붙여넣어 분석받기 위한 데이터 추출 */
export function ExportScreen() {
  const goBack = useGoBack('/history')
  const { logs } = useLogs()
  const { routines } = useRoutines()
  const nameOf = useExerciseNameOf()
  const { toast } = useDialog()
  const { copy } = useClipboard()

  const [period, setPeriod] = useState<Period>('3m')
  const [format, setFormat] = useState<Format>('ai')
  const [withRoutines, setWithRoutines] = useState(true)
  const [withNotes, setWithNotes] = useState(true)
  const [withPrompt, setWithPrompt] = useState(true)

  const to = localDate()
  const from = periodFrom(period)
  const inRange = useMemo(
    () => logs.filter((l) => (from == null || l.date >= from) && l.date <= to),
    [logs, from, to],
  )
  const fromLabel = from ?? inRange[inRange.length - 1]?.date ?? to

  const text = useMemo(() => {
    const opts = {
      logs: inRange,
      allLogs: logs,
      routines,
      nameOf,
      from,
      to,
      includeRoutines: withRoutines,
      includeNotes: withNotes,
    }
    if (format === 'raw') return compactJson(buildRawExport(opts))
    const json = compactJson(buildAiExport(opts))
    return withPrompt ? `${analysisPrompt(fromLabel, to)}\n\`\`\`json\n${json}\n\`\`\`\n` : json
  }, [inRange, logs, routines, nameOf, from, to, withRoutines, withNotes, withPrompt, format, fromLabel])

  const isMarkdown = format === 'ai' && withPrompt
  const filename = `gymlog-${format === 'ai' ? 'ai' : 'data'}-${period}-${to}.${isMarkdown ? 'md' : 'json'}`
  const mime = isMarkdown ? 'text/markdown' : 'application/json'
  const empty = inRange.length === 0

  const handleCopy = async () => {
    if (await copy(text)) toast('복사했어요. AI 채팅창에 붙여넣으세요', { type: 'success' })
    else toast('복사에 실패했어요. 파일로 저장해 주세요', { type: 'error' })
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  const handleShare = async () => {
    try {
      const file = new File([text], filename, { type: mime })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'gym-log 운동 기록' })
      } else {
        await navigator.share({ text, title: 'gym-log 운동 기록' })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('공유하지 못했어요', { type: 'error' })
    }
  }

  return (
    <OverlayPage>
      <TopBar onBack={goBack} title="기록 내보내기" />
      <PageBody>
        <section className={own.group}>
          <span className={own.label}>기간</span>
          <Segmented<Period>
            label="기간"
            value={period}
            onChange={setPeriod}
            options={(['1m', '3m', '6m', 'all'] as Period[]).map((p) => ({
              value: p,
              label: PERIOD_LABEL[p],
            }))}
          />
        </section>

        <section className={own.group}>
          <span className={own.label}>형식</span>
          <Segmented<Format>
            label="형식"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'ai', label: 'AI 분석용 요약' },
              { value: 'raw', label: '원본 데이터' },
            ]}
          />
          <p className={styles.hint} style={{ textAlign: 'left' }}>
            {format === 'ai'
              ? '세트를 "80x10"처럼 압축하고, 종목별 추이·직전 대비 과부하 판정을 함께 담아요.'
              : '앱에 저장된 기록을 그대로 내보내요. (전체 복원은 기록 탭의 백업 파일을 쓰세요)'}
          </p>
        </section>

        <div className={own.switches}>
          <SwitchRow label="루틴 포함" checked={withRoutines} onChange={setWithRoutines} />
          <SwitchRow
            label="메모 포함"
            hint="세트·종목 메모 (가동범위 부족, 통증 등)"
            checked={withNotes}
            onChange={setWithNotes}
          />
          {format === 'ai' && (
            <SwitchRow
              icon={<Sparkles size={18} />}
              label="분석 요청 문구 포함"
              hint="붙여넣기만 하면 바로 분석을 요청하는 문장을 앞에 붙여요"
              checked={withPrompt}
              onChange={setWithPrompt}
            />
          )}
        </div>

        <section className={own.preview}>
          <div className={own.previewHead}>
            <span>
              기록 <b>{inRange.length}</b>개 · {fromLabel.replace(/-/g, '.')} ~ {to.replace(/-/g, '.')}
            </span>
            <span className={own.size}>약 {approxKB(text)}KB</span>
          </div>
          <textarea
            className={own.textarea}
            value={empty ? '선택한 기간에 기록이 없어요.' : text}
            readOnly
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
          />
        </section>

        <div className={own.actions}>
          <Button size="lg" block onClick={handleCopy} disabled={empty}>
            <Copy size={18} /> 복사하기
          </Button>
          <div className={own.row2}>
            {canShare && (
              <Button variant="ghost" block onClick={handleShare} disabled={empty}>
                <Share2 size={18} /> 공유
              </Button>
            )}
            <Button
              variant="ghost"
              block
              onClick={() => {
                downloadText(filename, text, mime)
                toast('파일을 내려받았어요', { type: 'success' })
              }}
              disabled={empty}
            >
              <Download size={18} /> 파일로 저장
            </Button>
          </div>
        </div>

        <p className={own.privacy}>
          <ShieldCheck size={14} /> 앱은 데이터를 어디에도 보내지 않아요. 복사·공유·파일 저장은 직접
          누를 때만 일어나요.
        </p>
      </PageBody>
    </OverlayPage>
  )
}
