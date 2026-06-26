import { Play, ChevronRight, Dumbbell, Moon } from 'lucide-react'
import { Button } from '../components/Button'
import { type Tab } from '../components/TabBar'
import { useLogs, useRoutines, useSession } from '../hooks/useStores'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { todayWeekDay, WEEK_DAYS } from '../lib/days'
import { localDate, logStats } from '../lib/workout'
import styles from './Screen.module.css'
import home from './HomeScreen.module.css'

const WEEK_KR = ['일', '월', '화', '수', '목', '금', '토']

/** 이번 주(월~일) 시작일 YYYY-MM-DD */
function weekStart(d = new Date()): string {
  const day = d.getDay() // 0=일
  const diff = day === 0 ? 6 : day - 1 // 월요일까지 거슬러
  const mon = new Date(d)
  mon.setDate(d.getDate() - diff)
  return localDate(mon)
}

export function HomeScreen({
  onNavigate,
  onResumeWorkout,
}: {
  onNavigate: (t: Tab) => void
  onResumeWorkout: () => void
}) {
  const { routines } = useRoutines()
  const { logs } = useLogs()
  const { session } = useSession()
  const startWorkout = useStartWorkout()

  const now = new Date()
  const today = todayWeekDay(now)
  const todayLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEK_KR[now.getDay()]}요일`

  const todayRoutines = routines.filter((r) => r.days.includes(today))

  const ws = weekStart(now)
  const weekCount = logs.filter((l) => l.date >= ws).length

  const recent = logs.slice(0, 3)

  return (
    <main className={styles.screen}>
      <header className={home.hero}>
        <p className={home.date}>{todayLabel}</p>
        <h1 className={home.greeting}>
          {weekCount > 0
            ? `이번 주 ${weekCount}회 운동 🔥`
            : '오늘 한 세트 시작해볼까요 💪'}
        </h1>
      </header>

      {/* 이어하기 */}
      {session && (
        <button className={home.resume} onClick={onResumeWorkout}>
          <div className={home.resumeIcon}>
            <Play size={20} />
          </div>
          <div className={home.resumeBody}>
            <span className={home.resumeTitle}>운동 이어하기</span>
            <span className={home.resumeMeta}>
              {session.routineName} ·{' '}
              {session.exercises.filter((e) => e.done).length}/
              {session.exercises.length} 종목
            </span>
          </div>
          <ChevronRight size={20} className={home.resumeChevron} />
        </button>
      )}

      {/* 오늘의 루틴 */}
      <section className={home.section}>
        <h2 className={home.sectionTitle}>오늘의 루틴</h2>
        {todayRoutines.length === 0 ? (
          <div className={home.rest}>
            <Moon size={20} />
            <p>오늘은 휴식일이에요</p>
            <button
              className={home.restLink}
              onClick={() => onNavigate('routines')}
            >
              다른 루틴으로 운동하기
            </button>
          </div>
        ) : (
          todayRoutines.map((r) => (
            <div key={r.id} className={home.todayCard}>
              <div className={home.todayTop}>
                <span className={home.todayDays}>
                  {r.days.map((d) => WEEK_DAYS.find((w) => w.id === d)?.label).join('·')}
                </span>
              </div>
              <h3 className={home.todayName}>{r.name}</h3>
              <p className={home.todayMeta}>
                <Dumbbell size={14} /> {r.exercises.length}개 종목
              </p>
              <Button block onClick={() => startWorkout(r)}>
                <Play size={18} /> 운동 시작
              </Button>
            </div>
          ))
        )}
      </section>

      {/* 최근 기록 */}
      {recent.length > 0 && (
        <section className={home.section}>
          <div className={home.sectionHead}>
            <h2 className={home.sectionTitle}>최근 기록</h2>
            <button
              className={home.moreLink}
              onClick={() => onNavigate('history')}
            >
              전체 보기 <ChevronRight size={14} />
            </button>
          </div>
          <ul className={home.recentList}>
            {recent.map((l) => {
              const { totalSets } = logStats(l.exercises)
              return (
                <li
                  key={l.id}
                  className={home.recentItem}
                  onClick={() => onNavigate('history')}
                >
                  <span className={home.recentDate}>
                    {l.date.slice(5).replace('-', '.')}
                  </span>
                  <span className={home.recentName}>{l.routineName}</span>
                  <span className={home.recentMeta}>{totalSets}세트</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
