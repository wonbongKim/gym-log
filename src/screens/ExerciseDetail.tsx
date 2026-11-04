import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { LineChart, type ChartPoint } from '../components/LineChart'
import { OverlayPage, PageBody, TopBar } from '../components/Page'
import { Segmented } from '../components/Segmented'
import { useGoBack } from '../hooks/useGoBack'
import { useExercises, useLogs, useRoutines } from '../hooks/useStores'
import { exerciseMeta } from '../lib/exercises'
import {
  exerciseHistory,
  relativeDay,
  setNotesSummary,
  shortDateLabel,
  summarizeSetsShort,
} from '../lib/stats'
import { overloadSeries, type OverloadResult } from '../lib/overload'
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
  const { index } = useExercises()
  const history = useMemo(
    () => (exerciseId ? exerciseHistory(logs, exerciseId) : []),
    [logs, exerciseId],
  )
  if (!exerciseId || history.length === 0) return <Navigate to="/history/exercises" replace />
  // 종목 이름 우선, 없으면 가장 최근 기록의 snapshot 이름
  const info = index.byId.get(exerciseId)
  const latestName =
    info?.name ||
    logs.flatMap((l) => l.exercises).find((e) => e.exerciseId === exerciseId)?.exerciseName ||
    '종목'
  return (
    <ExerciseDetail
      exerciseId={exerciseId}
      name={latestName}
      infoLabel={exerciseMeta(info)}
      history={history}
    />
  )
}

function ExerciseDetail({
  exerciseId,
  name,
  infoLabel,
  history,
}: {
  exerciseId: string
  name: string
  /** "가슴 · 바벨" (정보 없으면 빈 문자열) */
  infoLabel: string
  history: ReturnType<typeof exerciseHistory>
}) {
  const navigate = useNavigate()
  const goBack = useGoBack('/history/exercises')
  const { routines } = useRoutines()
  const [metric, setMetric] = useState<Metric | null>(null)
  const [routineFilter, setRoutineFilter] = useState<string>('all')

  // 회차별 판정: 같은 루틴의 직전 수행 우선 (월/금 강도 차이가 섞이지 않게)
  const withOverload = useMemo(() => {
    const ol = overloadSeries(history, routines, exerciseId)
    return history.map((h, i) => ({ ...h, ol: ol[i] }))
  }, [history, routines, exerciseId])

  // 이 종목을 한 루틴이 2개 이상이면 루틴별로 나눠 볼 수 있게 (최근 수행 순, 최대 4개)
  const routineOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i]
      if (!seen.has(h.routineId)) seen.set(h.routineId, h.routineName)
    }
    return [...seen.entries()].slice(0, 4).map(([id, label]) => ({ id, label }))
  }, [history])

  const view =
    routineFilter === 'all'
      ? withOverload
      : withOverload.filter((h) => h.routineId === routineFilter)

  const weighted = view.some((h) => h.best.maxKg != null && h.best.maxKg > 0)
  const metrics: Metric[] = weighted ? ['e1rm', 'maxKg', 'volume'] : ['maxReps']
  const activeMetric = metric && metrics.includes(metric) ? metric : metrics[0]

  const points: ChartPoint[] = view
    .map((h) => {
      const v =
        activeMetric === 'e1rm'
          ? h.best.bestE1rm
          : activeMetric === 'maxKg'
            ? h.best.maxKg
            : activeMetric === 'volume'
              ? h.best.volume
              : h.best.maxReps
      return v == null ? null : { date: h.date, value: v }
    })
    .filter((p): p is ChartPoint => p != null)

  const maxKg = Math.max(...view.map((h) => h.best.maxKg ?? -Infinity))
  const bestE1rm = Math.max(...view.map((h) => h.best.bestE1rm ?? -Infinity))
  const maxReps = Math.max(...view.map((h) => h.best.maxReps))

  // 처음 대비 변화 (첫 기록 → 최근)
  const delta = points.length >= 2 ? points[points.length - 1].value - points[0].value : null
  const meta = METRIC_META[activeMetric]
  const recentFirst = [...view].reverse()
  const compared = view.filter((h) => h.ol.status !== 'first')
  const upRate = compared.length
    ? Math.round((compared.filter((h) => h.ol.status === 'up').length / compared.length) * 100)
    : null

  return (
    <OverlayPage>
      <TopBar
        onBack={goBack}
        title={name}
        subtitle={infoLabel ? `${infoLabel} · ${history.length}회 기록` : `${history.length}회 기록`}
      />
      <PageBody>
        {routineOptions.length > 1 && (
          <div className={own.routineChips} role="tablist" aria-label="루틴별 보기">
            {[{ id: 'all', label: '전체' }, ...routineOptions].map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={routineFilter === o.id}
                className={routineFilter === o.id ? own.routineChipOn : own.routineChip}
                onClick={() => setRoutineFilter(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

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
              value={activeMetric}
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
                    {routineOptions.length > 1 && routineFilter === 'all' && (
                      <span className={own.rowRoutine}>{h.routineName}</span>
                    )}
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
            ↑/↓ 는 같은 루틴의 직전 수행과 세트 단위로 비교해요 · 성공률 = ↑ 회차 / 비교 가능한 회차
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
