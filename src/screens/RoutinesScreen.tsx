import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  Dumbbell,
  Braces,
  Code,
  Play,
  Ellipsis,
  Copy,
  Clock,
  ClipboardList,
} from 'lucide-react'
import { Button } from '../components/Button'
import { Sheet, SheetItem } from '../components/Sheet'
import { useDialog } from '../components/DialogProvider'
import { formatDays, todayWeekDay, WEEK_DAYS } from '../lib/days'
import { estimateMinutes, relativeDay } from '../lib/stats'
import { useExerciseNameOf, useLogs, useRoutines } from '../hooks/useStores'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { useDeleteRoutine } from '../hooks/useDeleteRoutine'
import { routineToImportJson, routinesToImportJson } from '../lib/routineExport'
import type { Routine } from '../types'
import { RoutineEditor } from './RoutineEditor'
import { RoutineImport } from './RoutineImport'
import { RoutineJsonView } from './RoutineJsonView'
import styles from './Screen.module.css'
import list from './RoutinesScreen.module.css'

const DAY_ORDER = WEEK_DAYS.map((d) => d.id)

/** 요일 순(월→일)으로 정렬, 요일 없는 루틴은 맨 뒤 */
function dayRank(r: Routine): number {
  if (r.days.length === 0) return 99
  return Math.min(...r.days.map((d) => DAY_ORDER.indexOf(d)))
}

function EditRoute() {
  const { routineId } = useParams()
  const { routines } = useRoutines()
  const routine = routines.find((r) => r.id === routineId)
  if (!routine) return <Navigate to="/routines" replace />
  return <RoutineEditor key={routine.id} routine={routine} />
}

export function RoutinesScreen() {
  const navigate = useNavigate()
  const { routines, duplicate } = useRoutines()
  const { logs } = useLogs()
  const nameOf = useExerciseNameOf()
  const startWorkout = useStartWorkout()
  const deleteRoutine = useDeleteRoutine()
  const { toast } = useDialog()
  const [menuFor, setMenuFor] = useState<Routine | null>(null)
  const [viewing, setViewing] = useState<{ json: string; title: string } | null>(null)

  const today = todayWeekDay()
  const sorted = useMemo(
    () =>
      routines
        .map((r, i) => ({ r, i }))
        .sort((a, b) => dayRank(a.r) - dayRank(b.r) || a.i - b.i)
        .map((x) => x.r),
    [routines],
  )

  const lastDone = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of logs) if (!m.has(l.routineId)) m.set(l.routineId, l.date)
    return m
  }, [logs])

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>루틴</h1>
          {routines.length > 0 && (
            <p className={styles.subtitle}>카드를 누르면 수정, ▶ 버튼으로 바로 시작해요</p>
          )}
        </div>
      </header>

      {routines.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <ClipboardList size={24} />
          </span>
          <p className={styles.emptyTitle}>아직 루틴이 없어요</p>
          <p className={styles.emptyDesc}>
            요일과 종목을 정해 두면 운동할 때 직전 기록이 자동으로 채워져요.
          </p>
        </div>
      ) : (
        <ul className={list.list}>
          {sorted.map((r) => {
            const isToday = r.days.includes(today)
            const last = lastDone.get(r.id)
            return (
              <li key={r.id} className={isToday ? `${list.card} ${list.cardToday}` : list.card}>
                <button
                  className={list.cardMain}
                  onClick={() => navigate(`/routines/${r.id}`)}
                  aria-label={`${r.name} 수정`}
                >
                  <div className={list.cardTop}>
                    <span className={styles.chip}>{formatDays(r.days) || '요일 없음'}</span>
                    {isToday && <span className={list.todayChip}>오늘</span>}
                  </div>
                  <h2 className={list.name}>{r.name}</h2>
                  <p className={list.meta}>
                    <span>
                      <Dumbbell size={13} /> {r.exercises.length}종목
                    </span>
                    <span>
                      <Clock size={13} /> 약 {estimateMinutes(r, logs)}분
                    </span>
                    {last && <span>· 마지막 {relativeDay(last)}</span>}
                  </p>
                </button>
                <div className={list.side}>
                  <button
                    className={list.moreBtn}
                    onClick={() => setMenuFor(r)}
                    aria-label={`${r.name} 메뉴`}
                  >
                    <Ellipsis size={20} />
                  </button>
                  <button
                    className={list.playBtn}
                    onClick={() => startWorkout(r)}
                    aria-label={`${r.name} 운동 시작`}
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className={list.addWrap}>
        <Button block onClick={() => navigate('/routines/new')}>
          <Plus size={18} /> 루틴 추가
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/routines/import')}>
          <Braces size={18} /> JSON·AI로 루틴 가져오기
        </Button>
        {routines.length > 0 && (
          <button
            className={list.textLink}
            onClick={() =>
              setViewing({
                json: routinesToImportJson(sorted, nameOf),
                title: `전체 루틴 JSON (${routines.length}개)`,
              })
            }
          >
            <Code size={16} /> 전체 루틴 JSON 보기
          </button>
        )}
      </div>

      {menuFor && (
        <Sheet title={menuFor.name} onClose={() => setMenuFor(null)}>
          <SheetItem
            icon={<Play size={18} />}
            label="운동 시작"
            onClick={() => {
              const r = menuFor
              setMenuFor(null)
              startWorkout(r)
            }}
          />
          <SheetItem
            icon={<Pencil size={18} />}
            label="수정"
            onClick={() => {
              const r = menuFor
              setMenuFor(null)
              navigate(`/routines/${r.id}`)
            }}
          />
          <SheetItem
            icon={<Copy size={18} />}
            label="복제"
            hint="비슷한 루틴을 빠르게 만들 때"
            onClick={() => {
              duplicate(menuFor.id)
              setMenuFor(null)
              toast('루틴을 복제했어요', { type: 'success' })
            }}
          />
          <SheetItem
            icon={<Code size={18} />}
            label="JSON 보기·복사"
            onClick={() => {
              setViewing({ json: routineToImportJson(menuFor, nameOf), title: menuFor.name })
              setMenuFor(null)
            }}
          />
          <SheetItem
            icon={<Trash2 size={18} />}
            label="삭제"
            hint="지난 기록은 보존돼요"
            danger
            onClick={() => {
              const r = menuFor
              setMenuFor(null)
              deleteRoutine(r)
            }}
          />
        </Sheet>
      )}

      {viewing && (
        <RoutineJsonView
          json={viewing.json}
          title={viewing.title}
          onClose={() => setViewing(null)}
        />
      )}

      <Routes>
        <Route path="new" element={<RoutineEditor routine={null} />} />
        <Route path="import" element={<RoutineImport />} />
        <Route path=":routineId" element={<EditRoute />} />
      </Routes>
    </main>
  )
}
