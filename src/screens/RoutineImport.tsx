import { useCallback, useMemo, useState } from 'react'
import {
  FileJson,
  ClipboardPaste,
  CircleAlert,
  Sparkles,
  Copy,
  Check,
  Share2,
  Repeat2,
  MessageSquareText,
  Trash2,
} from 'lucide-react'
import { OverlayPage, PageBody, TopBar, TopBarAction } from '../components/Page'
import { Button } from '../components/Button'
import { Segmented } from '../components/Segmented'
import { useDialog } from '../components/DialogProvider'
import { parseRoutinesJson, RoutineParseError, SAMPLE_JSON } from '../lib/routineImport'
import { isNoopPlan, planImport, type ImportMode, type ImportPlanItem } from '../lib/routineMerge'
import { routinesToCompactJson } from '../lib/routineExport'
import { buildRoutineAiPrompt } from '../lib/routineAiPrompt'
import { formatDays } from '../lib/days'
import { useApplyRoutineImport, type RoutineImportResult } from '../hooks/useAddParsedRoutines'
import { useExerciseNameOf, useExercises, useRoutines } from '../hooks/useStores'
import { exerciseKey, exerciseNamesForPrompt, resolveExerciseId } from '../lib/exercises'
import { useClipboard } from '../hooks/useClipboard'
import { useGoBack } from '../hooks/useGoBack'
import type { ParsedExercise, ParsedRoutine } from '../lib/routineImport'
import editor from './RoutineEditor.module.css'
import own from './RoutineImport.module.css'

const MODE_OPTIONS: { value: ImportMode; label: string }[] = [
  { value: 'add', label: '새로 추가' },
  { value: 'merge', label: '같으면 수정' },
  { value: 'replace', label: '전체 바꾸기' },
]

const MODE_DESC: Record<ImportMode, string> = {
  add: '붙여넣은 루틴을 모두 새 루틴으로 추가해요. 기존 루틴은 그대로 둬요.',
  merge: 'id나 이름이 같은 루틴은 고치고, 나머지는 새로 추가해요. 지난 기록 연결은 유지돼요.',
  replace: '붙여넣은 루틴만 남기고 나머지는 삭제해요. 같은 루틴은 기록 연결이 유지돼요.',
}

/** 받침 유무에 따라 을/를 */
function eulReul(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 !== 0 ? '을' : '를'
}

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

function resultMessage(r: RoutineImportResult): string {
  if (r.mode === 'add') return `루틴 ${r.added}개를 추가했어요`
  const parts = [
    r.updated ? `수정 ${r.updated}` : '',
    r.added ? `추가 ${r.added}` : '',
    r.removed ? `삭제 ${r.removed}` : '',
  ].filter(Boolean)
  return `루틴을 적용했어요 · ${parts.join(' · ')}`
}

/** AI에게 붙여넣을 요청문 복사/공유 카드 */
function AiPromptCard() {
  const { routines } = useRoutines()
  const nameOf = useExerciseNameOf()
  const { exercises } = useExercises()
  const { copied, copy } = useClipboard(2000)
  const { toast } = useDialog()
  const [request, setRequest] = useState('')

  const buildPrompt = () =>
    buildRoutineAiPrompt(
      routines.length > 0 ? routinesToCompactJson(routines, nameOf) : null,
      request,
      exerciseNamesForPrompt(exercises),
    )

  const handleCopy = async () => {
    const ok = await copy(buildPrompt())
    if (ok) toast('요청문을 복사했어요. AI 채팅에 붙여넣어 주세요', { type: 'success' })
    else toast('복사하지 못했어요. 공유 버튼을 써 보세요.', { type: 'error' })
  }

  const handleShare = async () => {
    try {
      await navigator.share({ text: buildPrompt() })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      toast('공유하지 못했어요. 복사 버튼을 써 주세요.', { type: 'error' })
    }
  }

  return (
    <section className={own.aiCard} aria-labelledby="ai-card-title">
      <h3 id="ai-card-title" className={own.aiTitle}>
        <Sparkles size={18} /> AI에게 루틴 요청하기
      </h3>
      <ol className={own.aiSteps}>
        <li>요청문을 복사해 ChatGPT·Gemini 같은 AI 채팅에 붙여넣어요. 지금 루틴도 함께 들어가요.</li>
        <li>AI가 답한 JSON을 복사해 아래에 붙여넣으면 적용돼요.</li>
      </ol>
      <textarea
        className={own.aiRequest}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="원하는 변경사항 (선택) — 예: 무릎 부담 줄인 하체 루틴으로 바꿔줘"
        rows={2}
        aria-label="AI에게 요청할 변경사항"
      />
      <div className={own.aiActions}>
        <Button onClick={handleCopy} className={own.aiCopy}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? '복사됨' : 'AI 요청문 복사'}
        </Button>
        {canShare && (
          <Button variant="ghost" onClick={handleShare} aria-label="AI 요청문 공유">
            <Share2 size={18} /> 공유
          </Button>
        )}
      </div>
    </section>
  )
}

function PreviewCard({ item, showBadge }: { item: ImportPlanItem; showBadge: boolean }) {
  const { parsed: p, target, changes, newExerciseIdx, droppedExercises } = item
  const { index } = useExercises()
  const unchanged = !!target && changes.length === 0
  const badge = !target ? '새 루틴' : unchanged ? '변경 없음' : '수정'
  const badgeCls = !target ? own.badgeNew : unchanged ? own.badgeSame : own.badgeEdit
  /** 이미 있는 종목이면 그 종목, 처음 보는 이름이면 undefined */
  const known = (e: ParsedExercise) => {
    const id = resolveExerciseId(e, index)
    return id ? index.byId.get(id) : undefined
  }
  const unknownCount = p.exercises.filter((e) => !known(e)).length

  return (
    <div className={unchanged ? `${own.preview} ${own.previewSame}` : own.preview}>
      <div className={own.previewTop}>
        <span className={own.previewDays}>{formatDays(p.days)}</span>
        {showBadge && <span className={badgeCls}>{badge}</span>}
      </div>
      <h3 className={own.previewName}>{p.name}</h3>
      {target && target.name.trim() !== p.name.trim() && (
        <p className={own.previewSub}>기존 이름: {target.name}</p>
      )}
      {showBadge && target && changes.length > 0 && (
        <p className={own.changes}>{changes.join(' · ')}</p>
      )}

      {!unchanged && (
        <ul className={own.previewList}>
          {p.exercises.map((e, i) => {
            const ex = known(e)
            const renamed = ex && exerciseKey(ex.name) !== exerciseKey(e.name)
            return (
            <li key={i}>
              <div className={own.exMain}>
                <span className={own.exName}>
                  {e.name}
                  {target && newExerciseIdx.includes(i) && (
                    <span className={own.exNew}>루틴에 추가</span>
                  )}
                  {!ex && <span className={own.exUnknown}>처음 보는 종목</span>}
                </span>
                {renamed && <span className={own.exResolved}>→ {ex.name}(으)로 연결</span>}
                {e.alternatives && e.alternatives.length > 0 && (
                  <span className={own.exExtra}>
                    <Repeat2 size={12} aria-label="대체 종목" />
                    <span>{e.alternatives.join(', ')}</span>
                  </span>
                )}
                {e.note && (
                  <span className={own.exExtra}>
                    <MessageSquareText size={12} aria-label="메모" />
                    <span>{e.note}</span>
                  </span>
                )}
              </div>
              <span className={own.previewMeta}>
                {e.targetSets}세트 · {e.targetReps || '-'}
              </span>
            </li>
            )
          })}
        </ul>
      )}
      {!unchanged && droppedExercises.length > 0 && (
        <p className={own.dropped}>빠지는 종목: {droppedExercises.join(', ')}</p>
      )}
      {!unchanged && unknownCount > 0 && (
        <p className={own.unknownHint}>
          처음 보는 종목 {unknownCount}개는 내 종목으로 새로 등록돼요. 이미 하던 운동이라면 이름을
          목록에 있는 이름으로 바꿔야 지난 기록과 이어져요.
        </p>
      )}
    </div>
  )
}

export function RoutineImport() {
  const applyImport = useApplyRoutineImport()
  const { routines } = useRoutines()
  const nameOf = useExerciseNameOf()
  const { index } = useExercises()
  const goBack = useGoBack('/routines')
  const { toast, confirm } = useDialog()
  const [text, setText] = useState('')
  const [modeChoice, setModeChoice] = useState<ImportMode | null>(null)

  // 입력할 때마다 바로 검증·미리보기
  const result = useMemo<{ preview: ParsedRoutine[] | null; error: string | null }>(() => {
    if (!text.trim()) return { preview: null, error: null }
    try {
      return { preview: parseRoutinesJson(text), error: null }
    } catch (e) {
      return {
        preview: null,
        error: e instanceof RoutineParseError ? e.message : '파싱 중 오류가 발생했습니다.',
      }
    }
  }, [text])
  const { preview, error } = result

  const hasExisting = routines.length > 0
  // 기존 루틴과 겹치는 게 있으면 기본은 "같으면 수정", 아니면 "새로 추가"
  const resolveId = useCallback((e: ParsedExercise) => resolveExerciseId(e, index), [index])
  const anyMatch = useMemo(
    () =>
      !!preview &&
      hasExisting &&
      planImport(preview, routines, 'merge', nameOf, resolveId).items.some((it) => it.target),
    [preview, routines, nameOf, resolveId, hasExisting],
  )
  const mode: ImportMode = !hasExisting ? 'add' : (modeChoice ?? (anyMatch ? 'merge' : 'add'))

  const plan = useMemo(
    () => (preview ? planImport(preview, routines, mode, nameOf, resolveId) : null),
    [preview, routines, mode, nameOf, resolveId],
  )
  const noop = !plan || (mode !== 'add' && isNoopPlan(plan))

  const actionLabel =
    mode === 'merge'
      ? '적용'
      : mode === 'replace'
        ? '전체 바꾸기'
        : preview && preview.length > 1
          ? `${preview.length}개 추가`
          : '추가'

  const handleImport = async () => {
    if (!preview || !plan || noop) return
    if (mode === 'replace' && plan.removed.length > 0) {
      const ok = await confirm({
        title: `루틴 ${plan.removed.length}개가 삭제돼요`,
        message: (
          <>
            <ul className={own.confirmList}>
              {plan.removed.map((r) => (
                <li key={r.id}>
                  {r.name}
                  {r.days.length > 0 && (
                    <span className={own.confirmDays}> · {formatDays(r.days)}</span>
                  )}
                </li>
              ))}
            </ul>
            붙여넣은 루틴만 남기고 위 루틴은 삭제할까요? 지난 운동 기록은 그대로 남아요.
          </>
        ),
        confirmText: '전체 바꾸기',
        danger: true,
      })
      if (!ok) return
    }

    let res: RoutineImportResult
    try {
      res = applyImport(preview, mode)
    } catch {
      return // 저장 실패는 DialogProvider가 토스트로 알림
    }
    goBack()
    toast(resultMessage(res), {
      type: 'success',
      action: { label: '되돌리기', onClick: res.undo },
    })
  }

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setText(t)
      else toast('클립보드가 비어 있어요')
    } catch {
      toast('클립보드를 읽을 수 없어요. 직접 붙여넣어 주세요.', { type: 'error' })
    }
  }

  const summary = plan
    ? [
        plan.added ? `새 루틴 ${plan.added}개` : '',
        plan.updated ? `수정 ${plan.updated}개` : '',
        plan.unchanged ? `변경 없음 ${plan.unchanged}개` : '',
        plan.removed.length ? `삭제 ${plan.removed.length}개` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <OverlayPage variant="modal">
      <TopBar
        onBack={goBack}
        backIcon="close"
        title="루틴 가져오기"
        right={
          <TopBarAction onClick={handleImport} disabled={!preview || noop}>
            {actionLabel}
          </TopBarAction>
        }
      />

      <PageBody>
        <AiPromptCard />

        <div className={editor.field}>
          <span className={editor.label}>JSON 붙여넣기</span>
          <textarea
            className={`${own.textarea} ${error ? own.textareaError : ''}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE_JSON}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className={own.tools}>
            <button className={own.toolBtn} onClick={pasteFromClipboard} type="button">
              <ClipboardPaste size={16} /> 클립보드에서 붙여넣기
            </button>
            <button className={own.toolBtn} onClick={() => setText(SAMPLE_JSON)} type="button">
              <FileJson size={16} /> 예시 채우기
            </button>
          </div>
        </div>

        {error && (
          <div className={own.error} role="alert">
            <CircleAlert size={16} /> {error}
          </div>
        )}

        {preview && plan && (
          <>
            {hasExisting && (
              <div className={own.modeField}>
                <span className={editor.label}>적용 방식</span>
                <div className={own.modeSeg}>
                  <Segmented
                    label="적용 방식"
                    options={MODE_OPTIONS}
                    value={mode}
                    onChange={setModeChoice}
                  />
                </div>
                <p className={mode === 'replace' ? own.modeDescDanger : own.modeDesc}>
                  {MODE_DESC[mode]}
                </p>
              </div>
            )}

            <p className={noop ? own.previewHintDim : own.previewHint}>
              {noop
                ? `바뀌는 내용이 없어요 · ${summary}`
                : `미리보기 · ${summary} — 확인 후 상단 “${actionLabel}”${eulReul(actionLabel)} 누르세요.`}
            </p>

            {plan.items.map((it, pi) => (
              <PreviewCard key={pi} item={it} showBadge={hasExisting} />
            ))}

            {plan.removed.length > 0 && (
              <div className={own.removed}>
                <p className={own.removedTitle}>
                  <Trash2 size={16} /> 삭제될 루틴 {plan.removed.length}개
                </p>
                <ul className={own.removedList}>
                  {plan.removed.map((r) => (
                    <li key={r.id}>
                      <span className={own.removedName}>{r.name}</span>
                      <span className={own.previewMeta}>
                        {formatDays(r.days) || '요일 없음'} · {r.exercises.length}종목
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={own.removedHint}>지난 운동 기록은 그대로 남아요.</p>
              </div>
            )}
          </>
        )}

        {!text.trim() && (
          <p className={own.help}>
            여러 루틴은 배열(<code>[{'{…}'}, {'{…}'}]</code>)로 넣을 수 있어요. 요일은 <code>mon</code>·
            <code>월</code>·<code>월요일</code> 모두 인식해요. 종목에 <code>note</code>(메모)와{' '}
            <code>alternatives</code>(대체 종목)도 넣을 수 있어요. AI 답변을 통째로 붙여넣어도
            JSON 부분만 읽어요.
          </p>
        )}
      </PageBody>
    </OverlayPage>
  )
}
