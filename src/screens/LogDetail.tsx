import { Fragment, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  Copy,
  Ellipsis,
  Trash2,
  Trophy,
  ChevronRight,
  House,
  PartyPopper,
  ArrowLeftRight,
  NotebookPen,
} from 'lucide-react'
import { Button } from '../components/Button'
import { IconButton, OverlayPage, PageBody, TopBar } from '../components/Page'
import { Sheet, SheetItem } from '../components/Sheet'
import { useDialog } from '../components/DialogProvider'
import { useClipboard } from '../hooks/useClipboard'
import { useGoBack } from '../hooks/useGoBack'
import { useLogs, useRoutines } from '../hooks/useStores'
import {
  e1rm,
  exerciseBest,
  formatKg,
  formatMinutes,
  kgLabel,
  logMinutes,
  logStats,
  longDateLabel,
  PR_LABEL,
  prsInLog,
  shortDateLabel,
} from '../lib/stats'
import { overloadForLog } from '../lib/overload'
import type { WorkoutLog } from '../types'
import styles from './Screen.module.css'
import own from './LogDetail.module.css'

const OL_TEXT = { up: '↑', same: '=', down: '↓', first: '첫 기록' } as const

function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function LogDetailRoute() {
  const { logId } = useParams()
  const { logs } = useLogs()
  const log = logs.find((l) => l.id === logId)
  if (!log) return <Navigate to="/history" replace />
  return <LogDetail log={log} allLogs={logs} />
}

function LogDetail({ log, allLogs }: { log: WorkoutLog; allLogs: WorkoutLog[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const justFinished = (location.state as { justFinished?: boolean } | null)?.justFinished === true
  const goBack = useGoBack('/history')
  const { remove, addLog } = useLogs()
  const { confirm, toast } = useDialog()
  const { copy } = useClipboard()
  const [menu, setMenu] = useState(false)

  const { totalSets, totalVolume } = logStats(log.exercises)
  const minutes = logMinutes(log)
  const prs = useMemo(() => prsInLog(log, allLogs), [log, allLogs])
  const { routines } = useRoutines()
  const overload = useMemo(
    () => overloadForLog(log, allLogs, routines),
    [log, allLogs, routines],
  )
  const olCounts = { up: 0, same: 0, down: 0, first: 0 }
  overload.forEach((r) => (olCounts[r.status] += 1))
  const compared = olCounts.up + olCounts.same + olCounts.down

  const handleDelete = async () => {
    setMenu(false)
    const ok = await confirm({
      title: '이 기록을 삭제할까요?',
      message: `${shortDateLabel(log.date)} · ${log.routineName}`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    remove(log.id)
    goBack()
    toast('기록을 삭제했어요', { action: { label: '되돌리기', onClick: () => addLog(log) } })
  }

  const handleCopy = async () => {
    setMenu(false)
    if (await copy(JSON.stringify(log, null, 2))) toast('JSON을 복사했어요', { type: 'success' })
    else toast('복사에 실패했어요', { type: 'error' })
  }

  return (
    <OverlayPage>
      <TopBar
        onBack={justFinished ? () => navigate('/', { replace: true }) : goBack}
        backIcon={justFinished ? 'close' : 'back'}
        title={shortDateLabel(log.date)}
        right={
          <IconButton label="기록 메뉴" onClick={() => setMenu(true)}>
            <Ellipsis size={22} />
          </IconButton>
        }
      />

      <PageBody>
        {justFinished && (
          <div className={own.celebrate}>
            <PartyPopper size={28} className={own.celebrateIcon} />
            <div>
              <p className={own.celebrateTitle}>운동 완료! 수고했어요</p>
              <p className={own.celebrateDesc}>
                {compared > 0
                  ? `점진적 과부하 ${olCounts.up}/${compared}종목 성공${prs.size > 0 ? ` · 신기록 ${prs.size}개 🏆` : ''}`
                  : prs.size > 0
                    ? `오늘 신기록 ${prs.size}개를 세웠어요 🏆`
                    : '기록이 저장됐어요. 오늘이 다음 운동의 기준점이에요.'}
              </p>
            </div>
          </div>
        )}

        <div className={own.summary}>
          <h3 className={own.routineName}>{log.routineName}</h3>
          <p className={own.when}>
            {longDateLabel(log.date)}
            {log.startedAt && log.finishedAt && ` · ${timeOf(log.startedAt)}–${timeOf(log.finishedAt)}`}
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>운동 시간</span>
            <span className={styles.statValue}>{minutes > 0 ? formatMinutes(minutes) : '-'}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>세트</span>
            <span className={styles.statValue}>
              {totalSets}
              <span className={styles.statUnit}>세트</span>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>총 볼륨</span>
            <span className={styles.statValue}>{totalVolume > 0 ? formatKg(totalVolume) : '-'}</span>
          </div>
        </div>

        {log.exercises.map((ex, i) => {
          const best = exerciseBest(ex.sets)
          const pr = prs.get(ex.exerciseId)
          const ol = overload.get(ex.exerciseId)
          return (
            <section key={ex.exerciseId + i} className={own.exCard}>
              <button
                className={own.exHead}
                onClick={() => navigate(`/history/exercises/${ex.exerciseId}`)}
                aria-label={`${ex.exerciseName} 성장 그래프 보기`}
              >
                <span className={own.exTitle}>
                  <h4>{ex.exerciseName}</h4>
                  {ol && <span className={own[`ol_${ol.status}`]}>{OL_TEXT[ol.status]} {ol.status !== 'first' && ol.reason}</span>}
                  {pr && (
                    <span className={own.prBadge}>
                      <Trophy size={12} /> {PR_LABEL[pr]} 신기록
                    </span>
                  )}
                </span>
                <span className={own.exLink}>
                  {best.bestE1rm != null && <>1RM {best.bestE1rm}kg</>}
                  <ChevronRight size={16} />
                </span>
              </button>
              {ex.substitutedFrom && (
                <p className={own.subLine}>
                  <ArrowLeftRight size={12} /> {ex.substitutedFrom.exerciseName} 대신 수행
                </p>
              )}
              {ex.note && (
                <p className={own.exNote}>
                  <NotebookPen size={13} /> {ex.note}
                </p>
              )}
              <table className={own.setTable}>
                <thead>
                  <tr>
                    <th scope="col">세트</th>
                    <th scope="col">무게</th>
                    <th scope="col">횟수</th>
                    <th scope="col">추정 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, si) => {
                    const est = e1rm(s.kg, s.reps)
                    const isTop = est != null && est === best.bestE1rm
                    return (
                      <Fragment key={si}>
                        <tr className={isTop ? own.topRow : undefined}>
                          <td className={own.setNo}>
                            {s.done ? <Check size={14} strokeWidth={3} className={own.doneIcon} /> : null}
                            {s.setNo}
                          </td>
                          <td className={own.setKg}>{kgLabel(s.kg)}</td>
                          <td className={own.setReps}>{s.reps}회</td>
                          <td className={own.setEst}>{est != null ? `${est}` : '-'}</td>
                        </tr>
                        {s.note && (
                          <tr className={own.noteRow}>
                            <td colSpan={4}>└ {s.note}</td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )
        })}

        {justFinished && (
          <Button size="lg" block onClick={() => navigate('/', { replace: true })}>
            <House size={18} /> 홈으로
          </Button>
        )}
      </PageBody>

      {menu && (
        <Sheet title={log.routineName} onClose={() => setMenu(false)}>
          <SheetItem icon={<Copy size={18} />} label="이 기록 JSON 복사" onClick={handleCopy} />
          <SheetItem icon={<Trash2 size={18} />} label="기록 삭제" danger onClick={handleDelete} />
        </Sheet>
      )}
    </OverlayPage>
  )
}
