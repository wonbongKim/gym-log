import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Check,
  CheckCheck,
  Ellipsis,
  Timer,
  Sun,
  Volume2,
  History,
  Trash2,
  Search,
  Dumbbell,
  Repeat,
  ArrowDownToLine,
  NotebookPen,
  Target,
  Lightbulb,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '../components/Button'
import { NumInput } from '../components/NumInput'
import { OverlayPage, PageBody, TopBar, TopBarAction } from '../components/Page'
import { RestTimer } from '../components/RestTimer'
import { Sheet, SheetItem } from '../components/Sheet'
import { SwitchRow } from '../components/Switch'
import { NoteSheet, SET_NOTE_PRESETS, EXERCISE_NOTE_PRESETS } from '../components/NoteSheet'
import { useDialog } from '../components/DialogProvider'
import {
  useExercises,
  useLogs,
  useRoutines,
  useSession,
  useSettings,
} from '../hooks/useStores'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import {
  seedExercise,
  sessionProgress,
  sessionToLog,
  summarizeSets,
  type PrevRecord,
  type SaveMode,
} from '../lib/workout'
import { exerciseBest, formatClock, formatSet, setNotesSummary } from '../lib/stats'
import { compareSessions, nextTarget, type OverloadResult } from '../lib/overload'
import { primeAudio } from '../lib/sound'
import { addLogMakingRoom } from '../lib/storageCare'
import { downloadBackup } from '../lib/backup'
import { storage } from '../storage'
import type { LoggedExercise, SetRecord, WorkoutSession } from '../types'
import styles from './WorkoutScreen.module.css'

const REST_OPTIONS = [30, 60, 90, 120, 150, 180, 240]

function restLabel(sec: number): string {
  if (sec < 60) return `${sec}초`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}분 ${s}초` : `${m}분`
}

function targetLabel(ex: LoggedExercise): string {
  const t = ex.targetReps?.trim()
  if (!t) return `${ex.sets.length}세트`
  return `${ex.sets.length}세트 · 목표 ${/^\d/.test(t) ? `${t}회` : t}`
}

type NoteTarget = { ex: number; set: number | null }

export function WorkoutScreen() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const { logs, lastRecordOf } = useLogs()
  const { routines } = useRoutines()
  const { exercises: master, ensureExercise } = useExercises()
  const { settings, updateSettings } = useSettings()
  const { confirm, choose, toast } = useDialog()
  const now = useNow(1000)
  useWakeLock(settings.keepAwake)

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [noteFor, setNoteFor] = useState<NoteTarget | null>(null)
  const [subFor, setSubFor] = useState<number | null>(null)
  const [restSheet, setRestSheet] = useState(false)
  const [addSheet, setAddSheet] = useState(false)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  // 종목별 직전 기록 (세션 구성이 바뀔 때만 재계산)
  const exIdsKey = session?.exercises.map((e) => e.exerciseId).join('|') ?? ''
  const routineId = session?.routineId ?? ''
  const prevById = useMemo(() => {
    const map = new Map<string, PrevRecord | null>()
    exIdsKey
      .split('|')
      .filter(Boolean)
      .forEach((id) => {
        if (!map.has(id)) map.set(id, lastRecordOf(id, routineId))
      })
    return map
  }, [exIdsKey, routineId, lastRecordOf])

  const routine = routines.find((r) => r.id === session?.routineId)
  const routineExOf = (exerciseId: string) =>
    routine?.exercises.find((e) => e.exerciseId === exerciseId)

  /** 항상 스토리지의 최신 세션을 기준으로 변경 (연속 입력 시 유실 방지) */
  const patch = useCallback(
    (mutate: (s: WorkoutSession) => void) => {
      const cur = storage.getSession().session
      if (!cur) return
      const next = structuredClone(cur)
      mutate(next)
      setSession(next)
    },
    [setSession],
  )

  const skipRest = useCallback(() => patch((s) => (s.rest = null)), [patch])

  if (!session) return null

  const { doneSets, totalSets } = sessionProgress(session)
  const elapsed = formatClock((now - Date.parse(session.startedAt)) / 1000)
  const currentIdx = session.exercises.findIndex((e) => !e.sets.every((s) => s.done))

  const scrollToCard = (idx: number, delay = 280) => {
    window.setTimeout(() => {
      cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, delay)
  }

  // 세트 조작 -------------------------------------------------------------
  const updateSet = (exIdx: number, setIdx: number, p: Partial<SetRecord>) =>
    patch((s) => {
      s.exercises[exIdx].sets[setIdx] = { ...s.exercises[exIdx].sets[setIdx], ...p }
    })

  const toggleSet = (exIdx: number, setIdx: number) => {
    primeAudio()
    const set = session.exercises[exIdx].sets[setIdx]
    if (!set.done && set.reps <= 0) {
      toast('횟수를 먼저 입력해 주세요', { type: 'error' })
      return
    }
    let finishedExercise = false
    patch((s) => {
      const ex = s.exercises[exIdx]
      const target = ex.sets[setIdx]
      target.done = !target.done
      ex.done = ex.sets.every((x) => x.done)
      if (target.done) {
        const allDone = s.exercises.every((e) => e.sets.every((x) => x.done))
        s.rest = allDone
          ? null
          : {
              endsAt: new Date(Date.now() + settings.restSeconds * 1000).toISOString(),
              duration: settings.restSeconds,
            }
        finishedExercise = ex.done
      }
    })
    if (finishedExercise) {
      // 다 끝낸 종목은 접고 다음 종목으로
      setExpanded((prev) => {
        const next = new Set(prev)
        next.delete(exIdx)
        return next
      })
      const nextIdx = session.exercises.findIndex(
        (e, i) => i > exIdx && !e.sets.every((x) => x.done),
      )
      if (nextIdx >= 0) scrollToCard(nextIdx)
    }
  }

  const addSet = (exIdx: number) =>
    patch((s) => {
      const ex = s.exercises[exIdx]
      const last = ex.sets[ex.sets.length - 1]
      ex.sets.push({
        setNo: ex.sets.length + 1,
        kg: last ? last.kg : null,
        reps: last ? last.reps : 0,
        done: false,
      })
      ex.done = false
    })

  const removeLastSet = (exIdx: number) =>
    patch((s) => {
      const ex = s.exercises[exIdx]
      if (ex.sets.length <= 1) return
      ex.sets.pop()
      ex.done = ex.sets.every((x) => x.done)
    })

  const setAllDone = (exIdx: number, done: boolean) =>
    patch((s) => {
      const ex = s.exercises[exIdx]
      ex.sets.forEach((x) => (x.done = done ? x.done || x.reps > 0 : false))
      ex.done = ex.sets.every((x) => x.done)
    })

  const saveNote = (t: NoteTarget, note: string) =>
    patch((s) => {
      const ex = s.exercises[t.ex]
      if (t.set == null) ex.note = note || undefined
      else ex.sets[t.set].note = note || undefined
    })

  // 종목 조작 -------------------------------------------------------------
  const removeExercise = (exIdx: number) => {
    const removed = structuredClone(session.exercises[exIdx])
    patch((s) => {
      s.exercises.splice(exIdx, 1)
    })
    setExpanded(new Set())
    toast(`'${removed.exerciseName}' 종목을 뺐어요`, {
      action: {
        label: '되돌리기',
        onClick: () =>
          patch((s) => {
            s.exercises.splice(Math.min(exIdx, s.exercises.length), 0, removed)
          }),
      },
    })
  }

  /** 기구가 사용 중일 때: 맨 뒤로 미루기 */
  const postpone = (exIdx: number) => {
    const name = session.exercises[exIdx].exerciseName
    patch((s) => {
      const [ex] = s.exercises.splice(exIdx, 1)
      s.exercises.push(ex)
    })
    setExpanded(new Set())
    toast(`'${name}'을(를) 맨 뒤로 미뤘어요`)
    // 같은 인덱스에 다음 종목이 올라오므로 그 카드로
    if (exIdx < session.exercises.length - 1) scrollToCard(exIdx, 120)
  }

  /** 다른 종목으로 대체 — 이미 완료한 세트는 원래 종목으로 남기고 남은 세트만 바꾼다 */
  const substitute = (exIdx: number, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const target = ensureExercise(trimmed)
    const orig = session.exercises[exIdx]
    setSubFor(null)
    if (target.id === orig.exerciseId) return

    const snapshot = structuredClone(session.exercises)
    const doneCount = orig.sets.filter((s) => s.done).length
    const remaining = doneCount > 0 ? Math.max(1, orig.sets.length - doneCount) : orig.sets.length
    const replacement: LoggedExercise = {
      ...seedExercise(target.id, target.name, remaining, lastRecordOf(target.id, session.routineId), orig.targetReps),
      substitutedFrom: orig.substitutedFrom ?? {
        exerciseId: orig.exerciseId,
        exerciseName: orig.exerciseName,
      },
    }
    patch((s) => {
      if (doneCount > 0) {
        const kept = s.exercises[exIdx]
        kept.sets = kept.sets.filter((x) => x.done).map((x, i) => ({ ...x, setNo: i + 1 }))
        kept.done = true
        s.exercises.splice(exIdx + 1, 0, replacement)
      } else {
        s.exercises[exIdx] = replacement
      }
    })
    setExpanded(new Set())
    const newIdx = doneCount > 0 ? exIdx + 1 : exIdx
    scrollToCard(newIdx, 150)
    toast(
      doneCount > 0
        ? `완료한 ${doneCount}세트는 남기고 '${target.name}'(으)로 바꿨어요`
        : `'${orig.exerciseName}' → '${target.name}'`,
      {
        action: {
          label: '되돌리기',
          onClick: () => patch((s) => void (s.exercises = snapshot)),
        },
      },
    )
  }

  const addExercise = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const ex = ensureExercise(trimmed)
    const newIdx = session.exercises.length
    patch((s) => {
      s.exercises.push(seedExercise(ex.id, ex.name, 3, lastRecordOf(ex.id, session.routineId)))
    })
    setAddSheet(false)
    scrollToCard(newIdx, 120)
  }

  // 휴식 타이머 -----------------------------------------------------------
  const adjustRest = (delta: number) =>
    patch((s) => {
      if (!s.rest) return
      const end = Date.parse(s.rest.endsAt) + delta * 1000
      if (end <= Date.now()) {
        s.rest = null
        return
      }
      s.rest = {
        endsAt: new Date(end).toISOString(),
        duration: Math.max(1, s.rest.duration + delta),
      }
    })

  // 종료/취소 -------------------------------------------------------------
  const finish = async (mode: SaveMode) => {
    const log = sessionToLog(session, mode)
    if (log.exercises.length === 0) {
      toast('저장할 세트가 없어요', { type: 'error' })
      return
    }
    const cur = storage.getLogs()
    if (!storage.trySetLogs({ ...cur, logs: [log, ...cur.logs] })) {
      // 용량 초과 → 가장 오래된 기록부터 지워 공간 만들기 (진행 중 세션은 그대로 보존)
      const choice = await choose<'backup' | 'prune'>({
        title: '저장 공간이 가득 찼어요',
        message:
          '가장 오래된 기록부터 필요한 만큼만 지우고 오늘 기록을 저장할까요?\n지우기 전에 백업 파일을 받아 두는 걸 추천해요.',
        options: [
          { label: '백업 받고 정리 후 저장', value: 'backup' },
          { label: '바로 정리 후 저장', value: 'prune', variant: 'danger' },
        ],
        cancelText: '나중에 (운동 내용은 유지돼요)',
      })
      if (!choice) return
      if (choice === 'backup') downloadBackup()
      const res = addLogMakingRoom(log)
      if (!res) {
        toast('공간을 만들지 못했어요. 다른 데이터가 공간을 차지하고 있어요.', { type: 'error' })
        return
      }
      if (res.removed.length > 0) {
        toast(`오래된 기록 ${res.removed.length}개(${res.range})를 정리하고 저장했어요`, {
          type: 'success',
          duration: 4000,
        })
      }
    }
    setSession(null)
    navigate(`/history/log/${log.id}`, { replace: true, state: { justFinished: true } })
  }

  const handleFinish = async () => {
    const filled = session.exercises.reduce(
      (a, e) => a + e.sets.filter((s) => s.reps > 0).length,
      0,
    )
    if (filled === 0) {
      const ok = await confirm({
        title: '기록된 세트가 없어요',
        message: '이대로 종료하면 아무것도 저장되지 않아요.',
        confirmText: '저장하지 않고 종료',
        danger: true,
      })
      if (ok) {
        setSession(null)
        navigate('/', { replace: true })
      }
      return
    }

    if (doneSets === totalSets) {
      const ok = await confirm({
        title: '운동을 마칠까요?',
        message: `${doneSets}세트 · ${elapsed} 동안 수고했어요!`,
        confirmText: '저장하고 종료',
      })
      if (ok) finish('done')
      return
    }

    const left = totalSets - doneSets
    const mode = await choose<SaveMode>({
      title: doneSets === 0 ? '완료 체크한 세트가 없어요' : `완료하지 않은 세트가 ${left}개 있어요`,
      message:
        doneSets === 0
          ? '입력해 둔 세트를 모두 저장할까요?'
          : '어떻게 저장할까요? (횟수가 비어 있는 세트는 항상 제외돼요)',
      options:
        doneSets === 0
          ? [{ label: '입력한 세트 모두 저장', value: 'all' }]
          : [
              { label: `완료한 ${doneSets}세트만 저장`, value: 'done' },
              { label: '입력한 세트 모두 저장', value: 'all', variant: 'ghost' },
            ],
      cancelText: '계속 운동하기',
    })
    if (mode) finish(mode)
  }

  const handleCancel = async () => {
    const ok = await confirm({
      title: '운동을 취소할까요?',
      message: '입력한 기록은 저장되지 않아요.',
      confirmText: '운동 취소',
      cancelText: '계속 운동하기',
      danger: true,
    })
    if (!ok) return
    setSession(null)
    navigate('/', { replace: true })
  }

  // 진행 내용은 입력 즉시 저장돼 있으므로, 최소화는 화면만 벗어난다
  const handleMinimize = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  // 시트 데이터 ------------------------------------------------------------
  const menuEx = menuFor != null ? session.exercises[menuFor] : null
  const menuAllDone = menuEx ? menuEx.sets.every((s) => s.done) : false

  const noteEx = noteFor ? session.exercises[noteFor.ex] : null
  const noteValue = noteEx
    ? noteFor!.set == null
      ? noteEx.note ?? ''
      : noteEx.sets[noteFor!.set]?.note ?? ''
    : ''

  const subEx = subFor != null ? session.exercises[subFor] : null
  const subSuggestions = (() => {
    if (!subEx) return []
    const baseId = subEx.substitutedFrom?.exerciseId ?? subEx.exerciseId
    const fromRoutine = routineExOf(baseId)?.alternatives ?? []
    const usedBefore: string[] = []
    for (const l of logs) {
      for (const e of l.exercises) {
        if (e.substitutedFrom?.exerciseId === baseId && !usedBefore.includes(e.exerciseName)) {
          usedBefore.push(e.exerciseName)
        }
      }
    }
    const exclude = new Set([subEx.exerciseName, subEx.substitutedFrom?.exerciseName])
    return [
      { title: '루틴에 정해 둔 대체 종목', names: fromRoutine.filter((n) => !exclude.has(n)) },
      {
        title: '전에 대신했던 종목',
        names: usedBefore.filter((n) => !exclude.has(n) && !fromRoutine.includes(n)),
      },
    ].filter((g) => g.names.length > 0)
  })()

  return (
    <OverlayPage variant="modal">
      <TopBar
        onBack={handleMinimize}
        backIcon={<ChevronDown size={24} />}
        backLabel="최소화"
        title={session.routineName}
        subtitle={
          <>
            {elapsed} · {doneSets}/{totalSets}세트
          </>
        }
        right={<TopBarAction onClick={handleFinish}>완료</TopBarAction>}
      />
      <div className={styles.progress} aria-hidden>
        <div
          className={styles.progressFill}
          style={{ transform: `scaleX(${totalSets ? doneSets / totalSets : 0})` }}
        />
      </div>

      <PageBody className={session.rest ? styles.bodyWithRest : undefined}>
        <div className={styles.chips}>
          <button className={styles.chipBtn} onClick={() => setRestSheet(true)}>
            <Timer size={14} /> 휴식 {restLabel(settings.restSeconds)}
            <ChevronDown size={14} />
          </button>
          {settings.keepAwake && 'wakeLock' in navigator && (
            <span className={styles.chipInfo}>
              <Sun size={14} /> 화면 켜짐 유지
            </span>
          )}
        </div>
        <p className={styles.rule}>
          무게는 원판 kg(빈봉 제외) · <b>0</b> = 빈봉 · 빈칸 = 맨몸 · 세트 번호를 누르면 메모
        </p>

        {session.exercises.map((ex, exIdx) => {
          const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done)
          const prev = prevById.get(ex.exerciseId) ?? null
          return (
            <ExerciseCard
              key={`${ex.exerciseId}-${exIdx}`}
              ex={ex}
              index={exIdx}
              prev={prev}
              routineNote={routineExOf(ex.exerciseId)?.note}
              goal={nextTarget(prev?.sets ?? null, ex.targetReps)}
              overload={allDone ? compareSessions(ex.sets, prev?.sets ?? null) : null}
              current={exIdx === currentIdx}
              collapsed={allDone && !expanded.has(exIdx)}
              allDone={allDone}
              refCb={(el) => (cardRefs.current[exIdx] = el)}
              onExpand={() =>
                setExpanded((prevSet) => {
                  const next = new Set(prevSet)
                  if (next.has(exIdx)) next.delete(exIdx)
                  else next.add(exIdx)
                  return next
                })
              }
              onMenu={() => setMenuFor(exIdx)}
              onSubstitute={() => setSubFor(exIdx)}
              onNote={(setIdx) => setNoteFor({ ex: exIdx, set: setIdx })}
              onUpdateSet={(si, p) => updateSet(exIdx, si, p)}
              onToggleSet={(si) => toggleSet(exIdx, si)}
              onAddSet={() => addSet(exIdx)}
              onRemoveSet={() => removeLastSet(exIdx)}
            />
          )
        })}

        <Button variant="outline" block onClick={() => setAddSheet(true)}>
          <Plus size={18} /> 종목 추가
        </Button>

        <div className={styles.finishWrap}>
          <Button size="lg" block onClick={handleFinish}>
            <Check size={20} /> 운동 완료 · 기록 저장
          </Button>
          <button className={styles.cancelLink} onClick={handleCancel}>
            운동 취소 (저장 안 함)
          </button>
        </div>
      </PageBody>

      {session.rest && (
        <RestTimer
          rest={session.rest}
          sound={settings.restSound}
          onAdjust={adjustRest}
          onSkip={skipRest}
          onOpenSettings={() => setRestSheet(true)}
        />
      )}

      {menuEx && menuFor != null && (
        <Sheet title={menuEx.exerciseName} onClose={() => setMenuFor(null)}>
          <SheetItem
            icon={<Repeat size={18} />}
            label="다른 종목으로 대체"
            hint="기구를 누가 쓰고 있을 때"
            onClick={() => {
              const idx = menuFor
              setMenuFor(null)
              setSubFor(idx)
            }}
          />
          <SheetItem
            icon={<ArrowDownToLine size={18} />}
            label="나중에 하기 (맨 뒤로)"
            hint="자리가 나면 이어서"
            onClick={() => {
              const idx = menuFor
              setMenuFor(null)
              postpone(idx)
            }}
          />
          <SheetItem
            icon={<NotebookPen size={18} />}
            label={menuEx.note ? '종목 메모 수정' : '종목 메모'}
            hint={menuEx.note || '통증, 컨디션, 기구 변경 등'}
            onClick={() => {
              const idx = menuFor
              setMenuFor(null)
              setNoteFor({ ex: idx, set: null })
            }}
          />
          <SheetItem
            icon={<CheckCheck size={18} />}
            label={menuAllDone ? '모든 세트 완료 해제' : '모든 세트 완료'}
            onClick={() => {
              setAllDone(menuFor, !menuAllDone)
              setMenuFor(null)
            }}
          />
          <SheetItem
            icon={<Trash2 size={18} />}
            label="이번 운동에서 종목 빼기"
            hint="루틴에는 영향이 없어요"
            danger
            onClick={() => {
              const idx = menuFor
              setMenuFor(null)
              removeExercise(idx)
            }}
          />
        </Sheet>
      )}

      {noteFor && noteEx && (
        <NoteSheet
          key={`${noteFor.ex}-${noteFor.set}`}
          title={
            noteFor.set == null
              ? `${noteEx.exerciseName} 메모`
              : `${noteEx.exerciseName} · ${noteFor.set + 1}세트 메모`
          }
          description={
            noteFor.set == null
              ? '오늘 이 종목에 대한 메모예요. 다음에 할 때 "지난번 메모"로 보여 드려요.'
              : '같은 횟수라도 질이 달랐다면 남겨 두세요. 기록과 내보내기에 함께 저장돼요.'
          }
          value={noteValue}
          presets={noteFor.set == null ? EXERCISE_NOTE_PRESETS : SET_NOTE_PRESETS}
          placeholder={noteFor.set == null ? '예: 무릎이 아파서 가동범위 줄임' : '예: 8회 이후 풀가동 못함'}
          onSave={(v) => saveNote(noteFor, v)}
          onClose={() => setNoteFor(null)}
        />
      )}

      {subEx && subFor != null && (
        <ExercisePickerSheet
          title={`'${subEx.exerciseName}' 대신할 종목`}
          description={
            subEx.sets.some((s) => s.done)
              ? '완료한 세트는 원래 종목으로 남고, 남은 세트만 바뀌어요.'
              : '기록에 "○○ 대신"으로 표시돼요.'
          }
          names={master.map((e) => e.name).filter((n) => n !== subEx.exerciseName)}
          suggestions={subSuggestions}
          onPick={(n) => substitute(subFor, n)}
          onClose={() => setSubFor(null)}
        />
      )}

      {restSheet && (
        <Sheet
          title="휴식 타이머"
          description="세트를 완료 체크하면 자동으로 시작돼요."
          onClose={() => setRestSheet(false)}
        >
          <div className={styles.restGrid} role="radiogroup" aria-label="기본 휴식 시간">
            {REST_OPTIONS.map((sec) => (
              <button
                key={sec}
                role="radio"
                aria-checked={settings.restSeconds === sec}
                className={settings.restSeconds === sec ? styles.restOptOn : styles.restOpt}
                onClick={() => updateSettings({ restSeconds: sec })}
              >
                {restLabel(sec)}
              </button>
            ))}
          </div>
          <SwitchRow
            icon={<Volume2 size={18} />}
            label="종료 알림음"
            hint="휴식이 끝나면 짧게 알려요 (진동은 지원 기기만)"
            checked={settings.restSound}
            onChange={(v) => updateSettings({ restSound: v })}
          />
          <SwitchRow
            icon={<Sun size={18} />}
            label="화면 켜짐 유지"
            hint="운동 중 화면이 꺼지지 않게 해요"
            checked={settings.keepAwake}
            onChange={(v) => updateSettings({ keepAwake: v })}
          />
          <Button variant="ghost" block onClick={() => setRestSheet(false)}>
            닫기
          </Button>
        </Sheet>
      )}

      {addSheet && (
        <ExercisePickerSheet
          title="종목 추가"
          names={master.map((e) => e.name)}
          inSession={new Set(session.exercises.map((e) => e.exerciseName))}
          onPick={addExercise}
          onClose={() => setAddSheet(false)}
        />
      )}
    </OverlayPage>
  )
}

// 종목 카드 ------------------------------------------------------------------

const OVERLOAD_ICON: Record<OverloadResult['status'], string> = {
  up: '↑',
  same: '=',
  down: '↓',
  first: '★',
}

function ExerciseCard({
  ex,
  index,
  prev,
  routineNote,
  goal,
  overload,
  current,
  collapsed,
  allDone,
  refCb,
  onExpand,
  onMenu,
  onSubstitute,
  onNote,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onRemoveSet,
}: {
  ex: LoggedExercise
  index: number
  prev: PrevRecord | null
  routineNote?: string
  goal: string | null
  overload: OverloadResult | null
  current: boolean
  collapsed: boolean
  allDone: boolean
  refCb: (el: HTMLElement | null) => void
  onExpand: () => void
  onMenu: () => void
  onSubstitute: () => void
  onNote: (setIdx: number | null) => void
  onUpdateSet: (setIdx: number, p: Partial<SetRecord>) => void
  onToggleSet: (setIdx: number) => void
  onAddSet: () => void
  onRemoveSet: () => void
}) {
  const overloadBadge = overload && (
    <span className={styles[`ol_${overload.status}`]}>
      {OVERLOAD_ICON[overload.status]} {overload.reason}
    </span>
  )

  if (collapsed) {
    const best = exerciseBest(ex.sets)
    const top = ex.sets.find((s) => s.kg === best.maxKg) ?? ex.sets[0]
    return (
      <section ref={refCb} className={styles.cardCollapsed}>
        <button className={styles.collapsedBtn} onClick={onExpand} aria-expanded={false}>
          <span className={styles.doneBadge}>
            <Check size={16} strokeWidth={3} />
          </span>
          <span className={styles.collapsedBody}>
            <span className={styles.collapsedName}>{ex.exerciseName}</span>
            <span className={styles.collapsedMeta}>
              {ex.sets.length}세트{top ? ` · ${formatSet(top)}` : ''}
              {ex.note || ex.sets.some((s) => s.note) ? ' · 메모' : ''}
            </span>
          </span>
          {overloadBadge}
          <ChevronDown size={18} className={styles.collapsedChevron} />
        </button>
      </section>
    )
  }

  const cls = [styles.card, current ? styles.cardCurrent : '', allDone ? styles.cardDone : '']
    .filter(Boolean)
    .join(' ')
  const prevNotes = prev
    ? [prev.note?.trim(), setNotesSummary(prev.sets)].filter(Boolean).join(' · ')
    : ''

  return (
    <section ref={refCb} className={cls}>
      <div className={styles.cardHead}>
        <span className={styles.order}>{index + 1}</span>
        <div className={styles.titleWrap}>
          <h3 className={styles.exName}>{ex.exerciseName}</h3>
          <p className={styles.exMeta}>
            {targetLabel(ex)}
            {ex.substitutedFrom && (
              <span className={styles.subChip}>
                <ArrowLeftRight size={11} /> {ex.substitutedFrom.exerciseName} 대신
              </span>
            )}
          </p>
        </div>
        {allDone && (
          <button className={styles.headBtn} onClick={onExpand} aria-label="접기">
            <ChevronUp size={20} />
          </button>
        )}
        {!allDone && (
          <button className={styles.headBtn} onClick={onSubstitute} aria-label="다른 종목으로 대체">
            <Repeat size={18} />
          </button>
        )}
        <button className={styles.headBtn} onClick={onMenu} aria-label={`${ex.exerciseName} 메뉴`}>
          <Ellipsis size={20} />
        </button>
      </div>

      {routineNote && (
        <p className={styles.tip}>
          <Lightbulb size={13} /> {routineNote}
        </p>
      )}

      <div className={prev ? styles.prev : styles.prevFirst}>
        {prev ? (
          <>
            <p className={styles.prevLine}>
              <History size={13} className={styles.prevIcon} />
              <span>
                지난번 {prev.date.slice(5).replace('-', '.')} · {summarizeSets(prev.sets)}
              </span>
            </p>
            {prevNotes && <p className={styles.prevNote}>메모: {prevNotes}</p>}
            {goal && (
              <p className={styles.goal}>
                <Target size={13} /> {goal}
              </p>
            )}
          </>
        ) : (
          <p className={styles.prevLine}>
            <Sparkles size={13} className={styles.prevIcon} /> 첫 기록이에요 — 오늘이 기준점!
          </p>
        )}
      </div>

      {ex.note && (
        <button className={styles.exNote} onClick={() => onNote(null)}>
          <NotebookPen size={13} /> {ex.note}
        </button>
      )}

      <div className={styles.setHead} aria-hidden>
        <span>세트</span>
        <span>kg</span>
        <span>회</span>
        <span>완료</span>
      </div>
      <div className={styles.sets}>
        {ex.sets.map((set, si) => (
          <div key={si} className={styles.setBlock}>
            <div className={set.done ? styles.setRowDone : styles.setRow}>
              <button
                className={set.note ? styles.setNoHasNote : styles.setNo}
                onClick={() => onNote(si)}
                aria-label={`${set.setNo}세트 메모${set.note ? ` (${set.note})` : ''}`}
              >
                {set.setNo}
              </button>
              <span className={styles.kgCell}>
                <NumInput
                  decimal
                  className={set.kg === 0 ? `${styles.numInput} ${styles.numInputTagged}` : styles.numInput}
                  value={set.kg}
                  onValueChange={(v) => onUpdateSet(si, { kg: v })}
                  placeholder="맨몸"
                  aria-label={`${set.setNo}세트 무게(kg)`}
                />
                {set.kg === 0 && <span className={styles.kgTag}>빈봉</span>}
              </span>
              <NumInput
                className={styles.numInput}
                value={set.reps}
                emptyValue={0}
                onValueChange={(v) => onUpdateSet(si, { reps: v ?? 0 })}
                placeholder="0"
                aria-label={`${set.setNo}세트 횟수`}
              />
              <button
                className={set.done ? styles.checkOn : styles.check}
                onClick={() => onToggleSet(si)}
                aria-pressed={!!set.done}
                aria-label={`${set.setNo}세트 완료`}
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
            {set.note && (
              <button className={styles.setNote} onClick={() => onNote(si)}>
                {set.note}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className={styles.setActions}>
        <button className={styles.setAction} onClick={onAddSet}>
          <Plus size={16} /> 세트 추가
        </button>
        <button className={styles.setAction} onClick={onRemoveSet} disabled={ex.sets.length <= 1}>
          <Minus size={16} /> 마지막 세트 삭제
        </button>
      </div>
    </section>
  )
}

// 종목 선택 시트 (추가 / 대체 공용) -------------------------------------------

function ExercisePickerSheet({
  title,
  description,
  names,
  suggestions = [],
  inSession,
  onPick,
  onClose,
}: {
  title: string
  description?: string
  names: string[]
  suggestions?: { title: string; names: string[] }[]
  inSession?: Set<string>
  onPick: (name: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ko'))
  const filtered = query ? sorted.filter((n) => n.toLowerCase().includes(query)) : sorted
  const exact = sorted.some((n) => n.toLowerCase() === query)

  return (
    <Sheet title={title} description={description} onClose={onClose}>
      <form
        className={styles.searchRow}
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) onPick(filtered.length === 1 && !exact ? filtered[0] : q)
        }}
      >
        <Search size={18} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="종목 검색 또는 새 이름"
          enterKeyHint="done"
        />
      </form>

      {query && !exact && (
        <SheetItem
          icon={<Plus size={18} />}
          label={`'${q.trim()}' 새 종목으로`}
          onClick={() => onPick(q)}
        />
      )}

      {!query &&
        suggestions.map((g) => (
          <div key={g.title} className={styles.suggestGroup}>
            <p className={styles.groupTitle}>{g.title}</p>
            {g.names.map((n) => (
              <SheetItem
                key={n}
                icon={<Repeat size={18} />}
                label={n}
                active
                onClick={() => onPick(n)}
              />
            ))}
          </div>
        ))}

      {!query && suggestions.length > 0 && <p className={styles.groupTitle}>전체 종목</p>}
      {filtered.map((n) => (
        <SheetItem
          key={n}
          icon={<Dumbbell size={18} />}
          label={n}
          hint={inSession?.has(n) ? '이미 이번 운동에 있어요' : undefined}
          onClick={() => onPick(n)}
        />
      ))}
      {filtered.length === 0 && !query && (
        <p className={styles.sheetEmpty}>아직 등록된 종목이 없어요. 이름을 입력해 추가하세요.</p>
      )}
    </Sheet>
  )
}
