import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  ChevronRight,
  Dumbbell,
  Moon,
  Clock,
  Check,
  Flame,
  Plus,
  Sparkles,
  Layers,
} from 'lucide-react'
import { Button } from '../components/Button'
import { RoutinePickerSheet } from '../components/RoutinePickerSheet'
import { useDialog } from '../components/DialogProvider'
import { useExerciseNameOf, useLogs, useRoutines, useSession } from '../hooks/useStores'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { useAddParsedRoutines } from '../hooks/useAddParsedRoutines'
import { useNow } from '../hooks/useNow'
import { formatDays, todayWeekDay, WEEK_DAYS } from '../lib/days'
import { SAMPLE_ROUTINES } from '../lib/samples'
import { sessionProgress } from '../lib/workout'
import {
  estimateMinutes,
  formatClock,
  formatKg,
  localDate,
  logStats,
  relativeDay,
  shortDateLabel,
  totalTargetSets,
  weekDates,
  weekStreak,
} from '../lib/stats'
import type { Routine } from '../types'
import styles from './Screen.module.css'
import home from './HomeScreen.module.css'

const WEEK_KR = ['일', '월', '화', '수', '목', '금', '토']

function greetingFor(hour: number): string {
  if (hour < 6) return '늦은 시간까지 수고 많아요'
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후예요'
  return '오늘 하루도 고생했어요'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { routines } = useRoutines()
  const { logs } = useLogs()
  const { session } = useSession()
  const nameOf = useExerciseNameOf()
  const startWorkout = useStartWorkout()
  const addParsed = useAddParsedRoutines()
  const { toast } = useDialog()
  const [picking, setPicking] = useState(false)
  const nowMs = useNow(session ? 1000 : 60_000)

  const now = new Date(nowMs)
  const todayIso = localDate(now)
  const today = todayWeekDay(now)
  const todayLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEK_KR[now.getDay()]}요일`

  const todayRoutines = routines.filter((r) => r.days.includes(today))
  const week = weekDates(now)
  const loggedDays = useMemo(() => new Set(logs.map((l) => l.date)), [logs])
  const weekCount = logs.filter((l) => l.date >= week[0] && l.date <= week[6]).length
  const streak = useMemo(
    () => weekStreak(logs, new Date(todayIso + 'T12:00:00')),
    [logs, todayIso],
  )
  const recent = logs.slice(0, 3)

  const lastDoneOf = (r: Routine) => logs.find((l) => l.routineId === r.id)?.date

  const loadSamples = () => {
    addParsed(SAMPLE_ROUTINES)
    toast('예시 루틴 3개를 추가했어요', { type: 'success' })
  }

  return (
    <main className={styles.screen}>
      <header className={home.hero}>
        <p className={home.date}>{todayLabel}</p>
        <h1 className={home.greeting}>
          {weekCount > 0 ? (
            <>
              이번 주 <em className={home.em}>{weekCount}회</em> 운동했어요 🔥
            </>
          ) : (
            `${greetingFor(now.getHours())} 💪`
          )}
        </h1>

        {/* 주간 스트립 */}
        <ol className={home.week} aria-label="이번 주 운동 현황">
          {week.map((iso, i) => {
            const done = loggedDays.has(iso)
            const isToday = iso === todayIso
            const cls = [
              home.day,
              done ? home.dayDone : '',
              isToday ? home.dayToday : '',
              iso > todayIso ? home.dayFuture : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={iso} className={cls}>
                <span className={home.dayLabel}>{WEEK_DAYS[i].label}</span>
                <span className={home.dayDot} aria-label={done ? '운동함' : undefined}>
                  {done ? <Check size={14} strokeWidth={3} /> : Number(iso.slice(8))}
                </span>
              </li>
            )
          })}
        </ol>
        {streak > 1 && (
          <p className={home.streak}>
            <Flame size={14} /> {streak}주 연속 운동 중
          </p>
        )}
      </header>

      {/* 이어하기 */}
      {session && <ResumeCard nowMs={nowMs} onClick={() => navigate('/workout')} />}

      {/* 오늘의 루틴 */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>오늘의 루틴</h2>
          {routines.length > 0 && (
            <button className={styles.moreLink} onClick={() => navigate('/routines')}>
              루틴 관리 <ChevronRight size={14} />
            </button>
          )}
        </div>

        {routines.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Dumbbell size={24} />
            </span>
            <p className={styles.emptyTitle}>첫 루틴을 만들어 볼까요?</p>
            <p className={styles.emptyDesc}>
              요일별 루틴을 만들어 두면 매일 오늘 할 운동을 바로 시작할 수 있어요.
            </p>
            <div className={styles.emptyActions}>
              <Button block onClick={() => navigate('/routines/new')}>
                <Plus size={18} /> 루틴 만들기
              </Button>
              <Button variant="ghost" block onClick={loadSamples}>
                <Sparkles size={18} /> 예시 루틴 3개로 시작
              </Button>
            </div>
          </div>
        ) : todayRoutines.length === 0 ? (
          <div className={home.rest}>
            <span className={home.restIcon}>
              <Moon size={22} />
            </span>
            <div className={home.restBody}>
              <p className={home.restTitle}>오늘은 휴식일이에요</p>
              <p className={home.restDesc}>푹 쉬는 것도 운동이에요. 그래도 하고 싶다면?</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
              다른 루틴
            </Button>
          </div>
        ) : (
          <div className={home.todayList}>
            {todayRoutines.map((r) => {
              const doneToday = logs.some((l) => l.routineId === r.id && l.date === todayIso)
              const last = lastDoneOf(r)
              const sorted = [...r.exercises].sort((a, b) => a.order - b.order)
              const preview = sorted.slice(0, 4).map((e) => nameOf(e.exerciseId))
              const more = sorted.length - preview.length
              return (
                <article key={r.id} className={home.todayCard}>
                  <div className={home.todayTop}>
                    <span className={styles.chip}>{formatDays(r.days)}</span>
                    {doneToday ? (
                      <span className={styles.chipSuccess}>
                        <Check size={12} strokeWidth={3} /> 오늘 완료
                      </span>
                    ) : (
                      last && <span className={styles.chipMuted}>지난번 {relativeDay(last, now)}</span>
                    )}
                  </div>
                  <h3 className={home.todayName}>{r.name}</h3>
                  <p className={home.todayMeta}>
                    <span>
                      <Dumbbell size={14} /> {r.exercises.length}종목
                    </span>
                    <span>
                      <Layers size={14} /> {totalTargetSets(r)}세트
                    </span>
                    <span>
                      <Clock size={14} /> 약 {estimateMinutes(r, logs)}분
                    </span>
                  </p>
                  <ul className={home.exPreview}>
                    {preview.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                    {more > 0 && <li className={home.exMore}>+{more}</li>}
                  </ul>
                  <Button
                    block
                    size="lg"
                    variant={doneToday ? 'ghost' : 'primary'}
                    onClick={() => startWorkout(r)}
                  >
                    <Play size={18} fill="currentColor" /> {doneToday ? '한 번 더 하기' : '운동 시작'}
                  </Button>
                </article>
              )
            })}
            {routines.length > todayRoutines.length && (
              <button className={home.otherLink} onClick={() => setPicking(true)}>
                다른 루틴으로 운동하기
              </button>
            )}
          </div>
        )}
      </section>

      {/* 최근 기록 */}
      {recent.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>최근 기록</h2>
            <button className={styles.moreLink} onClick={() => navigate('/history')}>
              전체 보기 <ChevronRight size={14} />
            </button>
          </div>
          <ul className={home.recentList}>
            {recent.map((l) => {
              const { totalSets, totalVolume } = logStats(l.exercises)
              return (
                <li key={l.id}>
                  <button
                    className={home.recentItem}
                    onClick={() => navigate(`/history/log/${l.id}`)}
                  >
                    <span className={home.recentDate}>
                      <span className={home.recentDay}>{shortDateLabel(l.date).slice(0, 5)}</span>
                      <span className={home.recentRel}>{relativeDay(l.date, now)}</span>
                    </span>
                    <span className={home.recentBody}>
                      <span className={home.recentName}>{l.routineName}</span>
                      <span className={home.recentMeta}>
                        {l.exercises.length}종목 · {totalSets}세트
                        {totalVolume > 0 && ` · ${formatKg(totalVolume)}`}
                      </span>
                    </span>
                    <ChevronRight size={18} className={home.recentChevron} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {picking && (
        <RoutinePickerSheet
          routines={routines}
          onClose={() => setPicking(false)}
          onPick={(r) => {
            setPicking(false)
            startWorkout(r)
          }}
        />
      )}
    </main>
  )
}

function ResumeCard({ nowMs, onClick }: { nowMs: number; onClick: () => void }) {
  const { session } = useSession()
  if (!session) return null
  const { doneSets, totalSets, doneExercises } = sessionProgress(session)
  const ratio = totalSets ? doneSets / totalSets : 0
  return (
    <button className={home.resume} onClick={onClick}>
      <div className={home.resumeRow}>
        <span className={home.resumeIcon}>
          <Play size={20} fill="currentColor" />
        </span>
        <span className={home.resumeBody}>
          <span className={home.resumeTitle}>운동 이어하기</span>
          <span className={home.resumeMeta}>
            {session.routineName} · {doneExercises}/{session.exercises.length}종목
          </span>
        </span>
        <span className={home.resumeClock}>
          {formatClock((nowMs - Date.parse(session.startedAt)) / 1000)}
        </span>
      </div>
      <span className={home.resumeTrack} aria-hidden>
        <span className={home.resumeFill} style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </button>
  )
}
