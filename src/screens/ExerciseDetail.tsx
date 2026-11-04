import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { LineChart, type ChartPoint } from '../components/LineChart'
import { OverlayPage, PageBody, TopBar } from '../components/Page'
import { Segmented } from '../components/Segmented'
import { useGoBack } from '../hooks/useGoBack'
import { useExerciseNameOf, useLogs } from '../hooks/useStores'
import {
  exerciseHistory,
  relativeDay,
  setNotesSummary,
  shortDateLabel,
  summarizeSetsShort,
} from '../lib/stats'
import { compareSessions, type OverloadResult } from '../lib/overload'
import styles from './Screen.module.css'
import own from './ExerciseDetail.module.css'

type Metric = 'e1rm' | 'maxKg' | 'volume' | 'maxReps'

const METRIC_META: Record<Metric, { label: string; unit: string; title: string }> = {
  e1rm: { label: '추정 1RM', unit: 'kg', title: '추정 1RM 추이' },
  maxKg: { label: '최고 무게', unit: 'kg', title: '최고 무게 추이' },
  volume: { label: '볼륨', unit: 'kg', title: '세션 볼륨(무게×횟수) 추이' },
  maxReps: { label: '최다 횟수', unit: '회', title: '최다 횟수 추이' },
}

export function ExerciseDetailRoute() {
  const { exerciseId } = useParams()
  const { logs } = useLogs()
  const nameOf = useExerciseNameOf()
  const history = useMemo(
    () => (exerciseId ? exerciseHistory(logs, exerciseId) : []),
    [logs, exerciseId],
  )
  if (!exerciseId || history.length === 0) return <Navigate to="/history/exercises" replace />
  // 마스터 이름 우선, 없으면 가장 최근 기록의 snapshot 이름
  const latestName =
    nameOf(exerciseId) ||
    logs.flatMap((l) => l.exercises).find((e) => e.exerciseId === exerciseId)?.exerciseName ||
    '종목'
  return <ExerciseDetail name={latestName} history={history} />
}

function ExerciseDetail({
  name,
  history,
}: {
  name: string
  history: ReturnType<typeof exerciseHistory>
}) {
  const navigate = useNavigate()
  const goBack = useGoBack('/history/exercises')
  const weighted = history.some((h) => h.best.maxKg != null && h.best.maxKg > 0)
  const metrics: Metric[] = weighted ? ['e1rm', 'maxKg', 'volume'] : ['maxReps']
  const [metric, setMetric] = useState<Metric>(metrics[0])

  const points: ChartPoint[] = history
    .map((h) => {
      const v =
        metric === 'e1rm'
          ? h.best.bestE1rm
          : metric === 'maxKg'
            ? h.best.maxKg
            : metric === 'volume'
              ? h.best.volume
              : h.best.maxReps
      return v == null ? null : { date: h.date, value: v }
    })
    .filter((p): p is ChartPoint => p != null)

  const maxKg = Math.max(...history.map((h) => h.best.maxKg ?? -Infinity))
  const bestE1rm = Math.max(...history.map((h) => h.best.bestE1rm ?? -Infinity))
  const maxReps = Math.max(...history.map((h) => h.best.maxReps))

  // 처음 대비 변화 (첫 기록 → 최근)
  const delta = points.length >= 2 ? points[points.length - 1].value - points[0].value : null
  const meta = METRIC_META[metric]
  // 회차별 직전 대비 과부하 판정 (오래된 순으로 계산 후 최신순 표시)
  const withOverload = history.map((h, i) => ({
    ...h,
    ol: compareSessions(h.sets, i > 0 ? history[i - 1].sets : null),
  }))
  const recentFirst = [...withOverload].reverse()
  const compared = withOverload.filter((h) => h.ol.status !== 'first')
  const upRate = compared.length
    ? Math.round((compared.filter((h) => h.ol.status === 'up').length / compared.length) * 100)
    : null

  return (
    <OverlayPage>
      <TopBar onBack={goBack} title={name} subtitle={`${history.length}회 기록`} />
      <PageBody>
        <div className={styles.stats}>
          {weighted ? (
            <>
              <div className={styles.stat}>
                <span className={styles.statLabel}>최고 무게</span>
                <span className={styles.statValue}>
                  {maxKg}
                  <span className={styles.statUnit}>kg</span>
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>추정 1RM</span>
                <span className={styles.statValue}>
                  {Number.isFinite(bestE1rm) ? bestE1rm : '-'}
                  <span className={styles.statUnit}>kg</span>
                </span>
              </div>
            </>
          ) : (
            <div className={styles.stat}>
              <span className={styles.statLabel}>최다 횟수</span>
              <span className={styles.statValue}>
                {maxReps}
                <span className={styles.statUnit}>회</span>
              </span>
            </div>
          )}
          <div className={styles.stat}>
            <span className={styles.statLabel}>과부하 성공률</span>
            <span className={styles.statValue}>
              {upRate != null ? upRate : '-'}
              {upRate != null && <span className={styles.statUnit}>%</span>}
            </span>
          </div>
        </div>

        <section className={own.chartCard}>
          {metrics.length > 1 && (
            <Segmented<Metric>
              label="그래프 지표"
              value={metric}
              onChange={setMetric}
              options={metrics.map((m) => ({ value: m, label: METRIC_META[m].label }))}
            />
          )}
          <div className={own.chartHead}>
            <h3 className={own.chartTitle}>{meta.title}</h3>
            {delta != null && delta !== 0 && (
              <span className={delta > 0 ? own.deltaUp : own.deltaDown}>
                <TrendingUp size={14} /> 첫 기록 대비 {delta > 0 ? '+' : ''}
                {Math.round(delta * 10) / 10}
                {meta.unit}
              </span>
            )}
          </div>
          {points.length >= 2 ? (
            <LineChart points={points} unit={meta.unit} label={`${name} ${meta.title}`} />
          ) : (
            <p className={own.chartEmpty}>기록이 2회 이상 쌓이면 추이 그래프가 그려져요.</p>
          )}
          {points.length >= 2 && <p className={styles.hint}>그래프를 눌러 날짜별 값을 확인하세요</p>}
        </section>

        {/* 표 보기 — 그래프의 모든 값을 툴팁 없이도 확인 */}
        <section>
          <h3 className={own.listTitle}>전체 기록</h3>
          <ul className={own.list}>
            {recentFirst.map((h) => (
              <li key={h.logId + h.date}>
                <button className={own.row} onClick={() => navigate(`/history/log/${h.logId}`)}>
                  <span className={own.rowDate}>
                    {shortDateLabel(h.date)}
                    <span className={own.rowRel}>{relativeDay(h.date)}</span>
                  </span>
                  <span className={own.rowMain}>
                    <span className={own.rowSets}>{summarizeSetsShort(h.sets)}</span>
                    <OlTag ol={h.ol} />
                    {setNotesSummary(h.sets) && (
                      <span className={own.rowNote}>{setNotesSummary(h.sets)}</span>
                    )}
                  </span>
                  <span className={own.rowBest}>
                    {h.best.bestE1rm != null ? `${h.best.bestE1rm}` : `${h.best.maxReps}회`}
                  </span>
                  <ChevronRight size={16} className={own.rowChevron} />
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.hint}>
            ↑ 지난번보다 무게·횟수·볼륨 중 하나라도 늘었을 때 · 성공률 = ↑ 회차 / 비교 가능한 회차
            {weighted && ' · 오른쪽 숫자는 그날의 추정 1RM(kg)'}
          </p>
        </section>
      </PageBody>
    </OverlayPage>
  )
}

function OlTag({ ol }: { ol: OverloadResult }) {
  if (ol.status === 'first') return <span className={own.olFirst}>첫 기록</span>
  const cls = ol.status === 'up' ? own.olUp : ol.status === 'down' ? own.olDown : own.olSame
  const icon = ol.status === 'up' ? '↑' : ol.status === 'down' ? '↓' : '='
  return (
    <span className={cls}>
      {icon} {ol.reason}
    </span>
  )
}
