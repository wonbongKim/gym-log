import { useMemo, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Download,
  Upload,
  ChevronRight,
  ChevronLeft,
  Code,
  Database,
  Trophy,
  CalendarDays,
  Dumbbell,
  Clock,
  Sparkles,
  Eraser,
  Trash2,
} from 'lucide-react'
import { Segmented } from '../components/Segmented'
import { Sheet, SheetItem } from '../components/Sheet'
import { useDialog } from '../components/DialogProvider'
import { useExerciseNameOf, useLogs, useSettings } from '../hooks/useStores'
import {
  exerciseSummaries,
  formatKg,
  formatMinutes,
  localDate,
  logMinutes,
  logStats,
  prsInLog,
  relativeDay,
  shortDateLabel,
  weekdayKr,
} from '../lib/stats'
import { KEYS, storage } from '../storage'
import {
  BackupError,
  backupSummary,
  downloadBackup,
  parseBackup,
  restoreBackup,
} from '../lib/backup'
import type { WorkoutLog } from '../types'
import {
  countBefore,
  formatBytes,
  monthsAgo,
  pruneBefore,
  pruneOldest,
  QUOTA_BYTES,
  storageUsage,
} from '../lib/storageCare'
import { LogDetailRoute } from './LogDetail'
import { ExportScreen } from './ExportScreen'
import { ExerciseDetailRoute } from './ExerciseDetail'
import { RoutineJsonView } from './RoutineJsonView'
import styles from './Screen.module.css'
import hs from './HistoryScreen.module.css'

type View = 'logs' | 'exercises'

export function HistoryScreen() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const view: View = pathname.startsWith('/history/exercises') ? 'exercises' : 'logs'
  const { logs } = useLogs()
  const [dataSheet, setDataSheet] = useState(false)
  const [jsonView, setJsonView] = useState(false)

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>기록</h1>
        <button className={styles.headerBtn} onClick={() => setDataSheet(true)} aria-label="데이터 내보내기·백업">
          <Database size={16} /> 내보내기
        </button>
      </header>

      {logs.length > 0 && (
        <div className={hs.segment}>
          <Segmented<View>
            label="보기 방식"
            value={view}
            onChange={(v) => navigate(v === 'logs' ? '/history' : '/history/exercises', { replace: true })}
            options={[
              { value: 'logs', label: '날짜별' },
              { value: 'exercises', label: '종목별 성장' },
            ]}
          />
        </div>
      )}

      {logs.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <CalendarDays size={24} />
          </span>
          <p className={styles.emptyTitle}>아직 운동 기록이 없어요</p>
          <p className={styles.emptyDesc}>
            운동을 마치면 날짜별 기록과 종목별 성장 그래프가 여기에 쌓여요.
          </p>
        </div>
      ) : view === 'logs' ? (
        <LogsView logs={logs} />
      ) : (
        <ExercisesView logs={logs} />
      )}

      {dataSheet && (
        <DataSheet
          onClose={() => setDataSheet(false)}
          onShowJson={() => {
            setDataSheet(false)
            setJsonView(true)
          }}
        />
      )}
      {jsonView && (
        <RoutineJsonView
          json={storage.exportAll()}
          title="전체 데이터 JSON"
          onClose={() => setJsonView(false)}
        />
      )}

      <Routes>
        <Route path="log/:logId" element={<LogDetailRoute />} />
        <Route path="export" element={<ExportScreen />} />
        <Route path="exercises/:exerciseId" element={<ExerciseDetailRoute />} />
      </Routes>
    </main>
  )
}

// 날짜별 ----------------------------------------------------------------------

const WEEK_HEAD = ['월', '화', '수', '목', '금', '토', '일']

function LogsView({ logs }: { logs: WorkoutLog[] }) {
  const navigate = useNavigate()
  const { choose } = useDialog()
  const todayIso = localDate()
  const [month, setMonth] = useState(() => todayIso.slice(0, 7)) // YYYY-MM

  const byDate = useMemo(() => {
    const m = new Map<string, WorkoutLog[]>()
    for (const l of logs) m.set(l.date, [...(m.get(l.date) ?? []), l])
    return m
  }, [logs])

  const monthLogs = logs.filter((l) => l.date.startsWith(month))
  const monthSets = monthLogs.reduce((a, l) => a + logStats(l.exercises).totalSets, 0)
  const monthVolume = monthLogs.reduce((a, l) => a + logStats(l.exercises).totalVolume, 0)

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // 월요일 시작
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const isCurrentMonth = month === todayIso.slice(0, 7)
  const oldest = logs[logs.length - 1]?.date.slice(0, 7) ?? month

  const openDay = async (iso: string) => {
    const dayLogs = byDate.get(iso)
    if (!dayLogs) return
    if (dayLogs.length === 1) {
      navigate(`/history/log/${dayLogs[0].id}`)
      return
    }
    const id = await choose<string>({
      title: shortDateLabel(iso),
      message: `이 날 ${dayLogs.length}번 운동했어요.`,
      options: dayLogs.map((l) => ({ label: l.routineName, value: l.id, variant: 'ghost' as const })),
      cancelText: '닫기',
    })
    if (id) navigate(`/history/log/${id}`)
  }

  return (
    <>
      <section className={hs.calendar} aria-label="월간 운동 달력">
        <div className={hs.calHead}>
          <button
            className={hs.calNav}
            onClick={() => shiftMonth(-1)}
            disabled={month <= oldest}
            aria-label="이전 달"
          >
            <ChevronLeft size={20} />
          </button>
          <span className={hs.calTitle}>
            {y}년 {m}월
          </span>
          <button
            className={hs.calNav}
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            aria-label="다음 달"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className={hs.calGrid}>
          {WEEK_HEAD.map((w) => (
            <span key={w} className={hs.calWeek}>
              {w}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                className={[
                  hs.calDay,
                  byDate.has(iso) ? hs.calDayOn : '',
                  iso === todayIso ? hs.calToday : '',
                  iso > todayIso ? hs.calFuture : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => openDay(iso)}
                disabled={!byDate.has(iso)}
                aria-label={`${Number(iso.slice(8))}일${byDate.has(iso) ? ' 운동함' : ''}`}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
        <div className={hs.calSummary}>
          <span>
            <strong>{monthLogs.length}</strong>회 운동
          </span>
          <span>
            <strong>{monthSets}</strong>세트
          </span>
          {monthVolume > 0 && (
            <span>
              <strong>{Math.round(monthVolume).toLocaleString()}</strong>kg
            </span>
          )}
        </div>
      </section>

      {monthLogs.length === 0 ? (
        <p className={hs.monthEmpty}>
          {isCurrentMonth ? '이번 달엔 아직 기록이 없어요. 오늘 시작해 볼까요?' : '이 달엔 기록이 없어요.'}
        </p>
      ) : (
        <ul className={hs.list}>
          {monthLogs.map((log) => {
            const { totalSets, totalVolume } = logStats(log.exercises)
            const minutes = logMinutes(log)
            const prs = prsInLog(log, logs).size
            return (
              <li key={log.id}>
                <button className={hs.card} onClick={() => navigate(`/history/log/${log.id}`)}>
                  <span className={hs.dateBox}>
                    <span className={hs.dateNum}>{Number(log.date.slice(8))}</span>
                    <span className={hs.dateDow}>{weekdayKr(log.date)}</span>
                  </span>
                  <span className={hs.cardBody}>
                    <span className={hs.name}>{log.routineName}</span>
                    <span className={hs.meta}>
                      {log.exercises.length}종목 · {totalSets}세트
                      {totalVolume > 0 && ` · ${formatKg(totalVolume)}`}
                      {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                    </span>
                    {prs > 0 && (
                      <span className={hs.pr}>
                        <Trophy size={12} /> 신기록 {prs}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={18} className={hs.chevron} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// 종목별 ----------------------------------------------------------------------

function ExercisesView({ logs }: { logs: WorkoutLog[] }) {
  const navigate = useNavigate()
  const nameOf = useExerciseNameOf()
  const list = useMemo(() => exerciseSummaries(logs, nameOf), [logs, nameOf])

  return (
    <ul className={hs.exList}>
      {list.map((s) => (
        <li key={s.exerciseId}>
          <button className={hs.exItem} onClick={() => navigate(`/history/exercises/${s.exerciseId}`)}>
            <span className={hs.exIcon}>
              <Dumbbell size={18} />
            </span>
            <span className={hs.cardBody}>
              <span className={hs.name}>{s.name}</span>
              <span className={hs.meta}>
                <Clock size={12} /> {relativeDay(s.lastDate)} · {s.sessions}회 기록
              </span>
            </span>
            <span className={hs.exBest}>
              {s.maxKg != null ? (
                <>
                  <span className={hs.exBestValue}>{s.maxKg}kg</span>
                  <span className={hs.exBestLabel}>최고 무게</span>
                </>
              ) : (
                <>
                  <span className={hs.exBestValue}>{s.maxReps}회</span>
                  <span className={hs.exBestLabel}>최다 횟수</span>
                </>
              )}
            </span>
            <ChevronRight size={18} className={hs.chevron} />
          </button>
        </li>
      ))}
    </ul>
  )
}

// 데이터 관리 시트 --------------------------------------------------------------

function DataSheet({ onClose, onShowJson }: { onClose: () => void; onShowJson: () => void }) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { logs } = useLogs()
  const { confirm, choose, toast } = useDialog()
  const fileRef = useRef<HTMLInputElement>(null)
  const usage = storageUsage()
  const otherBytes = usage.totalBytes - usage.appBytes

  /** 오래된 기록 정리 — 기준 선택 → 백업 여부 → 삭제 */
  const handleCleanup = async () => {
    const y1 = monthsAgo(12)
    const m6 = monthsAgo(6)
    const options: { label: string; value: string; variant?: 'ghost' }[] = []
    if (countBefore(y1) > 0)
      options.push({ label: `1년보다 오래된 기록 ${countBefore(y1)}개`, value: 'y1', variant: 'ghost' })
    if (countBefore(m6) > 0)
      options.push({ label: `6개월보다 오래된 기록 ${countBefore(m6)}개`, value: 'm6', variant: 'ghost' })
    const n = Math.min(10, logs.length)
    if (n > 0) options.push({ label: `가장 오래된 기록 ${n}개`, value: 'n', variant: 'ghost' })
    if (options.length === 0) {
      toast('정리할 기록이 없어요')
      return
    }
    const which = await choose<string>({
      title: '어떤 기록을 정리할까요?',
      message: '오래된 기록부터 지워요. 지운 기록은 백업 파일로만 되살릴 수 있어요.',
      options,
    })
    if (!which) return
    const how = await choose<'backup' | 'now'>({
      title: '지우기 전에 백업할까요?',
      options: [
        { label: '백업 받고 지우기', value: 'backup' },
        { label: '바로 지우기', value: 'now', variant: 'danger' },
      ],
    })
    if (!how) return
    if (how === 'backup') downloadBackup()
    const res = which === 'y1' ? pruneBefore(y1) : which === 'm6' ? pruneBefore(m6) : pruneOldest(n)
    onClose()
    toast(`기록 ${res.removed.length}개(${res.range})를 정리했어요`, { type: 'success' })
  }

  /** 데이터 지우기 — 범위 선택(기록만 / 전부) → 백업 여부 → 지우기 (잠깐 되돌리기 가능) */
  const handleReset = async () => {
    const routineCount = storage.getRoutines().routines.length
    const customCount = storage.getExercises().exercises.length
    const hasSession = !!storage.getSession().session
    const scope = await choose<'logs' | 'all'>({
      title: '어떤 데이터를 지울까요?',
      message:
        '이 기기에 저장된 gym-log 데이터만 지워요. 지운 데이터는 백업 파일로만 되살릴 수 있어요.',
      options: [
        { label: `운동 기록만 지우기 (${logs.length}개, 루틴은 남김)`, value: 'logs', variant: 'ghost' },
        { label: '전부 지우고 처음 상태로', value: 'all', variant: 'danger' },
      ],
    })
    if (!scope) return
    if (scope === 'logs' && logs.length === 0 && !hasSession) {
      toast('지울 운동 기록이 없어요')
      return
    }
    const lines =
      scope === 'logs'
        ? [`운동 기록 ${logs.length}개`]
        : [`운동 기록 ${logs.length}개`, `루틴 ${routineCount}개`, `직접 추가한 종목 ${customCount}개`, '설정(휴식 시간 등)']
    if (hasSession) lines.push('진행 중인 운동')
    const how = await choose<'backup' | 'now'>({
      title: '정말 지울까요?',
      message: `지워지는 것: ${lines.join(' · ')}\n지운 직후 잠깐은 '되돌리기'로 살릴 수 있어요.`,
      options: [
        { label: '백업 받고 지우기', value: 'backup' },
        { label: '백업 없이 지우기', value: 'now', variant: 'danger' },
      ],
    })
    if (!how) return
    if (how === 'backup') downloadBackup()
    const snapshot = storage.clear(scope === 'logs' ? [KEYS.logs, KEYS.session] : undefined)
    onClose()
    if (scope === 'all') navigate('/')
    toast(scope === 'logs' ? '운동 기록을 모두 지웠어요' : '모든 데이터를 지웠어요', {
      type: 'success',
      duration: 8000,
      action: { label: '되돌리기', onClick: () => storage.restoreSnapshot(snapshot) },
    })
  }

  const handleImportFile = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      const ok = await confirm({
        title: '백업으로 덮어쓸까요?',
        message: `${backupSummary(backup)}\n현재 루틴·종목·기록이 모두 이 백업으로 교체돼요.`,
        confirmText: '복원하기',
        danger: true,
      })
      if (!ok) return
      restoreBackup(backup)
      onClose()
      toast('복원을 완료했어요', { type: 'success' })
    } catch (e) {
      toast(e instanceof BackupError ? e.message : '가져오기에 실패했어요.', { type: 'error' })
    }
  }

  const last = settings.lastBackupAt
  return (
    <Sheet
      title="데이터 내보내기·백업"
      description={
        '데이터는 이 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업해 두세요.\n' +
        (last ? `마지막 백업: ${relativeDay(localDate(new Date(last)))}` : '아직 백업한 적이 없어요.')
      }
      onClose={onClose}
    >
      <SheetItem
        icon={<Sparkles size={18} />}
        label="기간별 내보내기 (AI 분석용)"
        hint="1·3·6개월 기록을 복사·공유·파일로"
        active
        onClick={() => {
          onClose()
          navigate('/history/export')
        }}
      />
      <SheetItem
        icon={<Download size={18} />}
        label="백업 파일 내보내기"
        hint="루틴·종목·기록 전체를 JSON 파일로 저장"
        onClick={() => {
          downloadBackup()
          toast('백업 파일을 내려받았어요', { type: 'success' })
        }}
      />
      <SheetItem
        icon={<Upload size={18} />}
        label="백업 파일 가져오기"
        hint="현재 데이터를 백업 내용으로 교체"
        onClick={() => fileRef.current?.click()}
      />
      <SheetItem icon={<Code size={18} />} label="JSON 보기·복사" onClick={onShowJson} />

      <div className={hs.usage}>
        <div className={hs.usageHead}>
          <span>저장 공간</span>
          <span className={hs.usageNum}>
            약 {formatBytes(usage.totalBytes)} / {formatBytes(QUOTA_BYTES)}
          </span>
        </div>
        <div className={hs.usageTrack} aria-hidden>
          <span
            className={usage.ratio > 0.8 ? hs.usageFillWarn : hs.usageFill}
            style={{ transform: `scaleX(${Math.max(0.01, usage.ratio)})` }}
          />
        </div>
        <p className={hs.usageHint}>
          gym-log {formatBytes(usage.appBytes)} · 기록 {logs.length}개
          {otherBytes > 1024 && ` · 같은 사이트의 다른 데이터 ${formatBytes(otherBytes)}`}
          <br />
          가득 차면 가장 오래된 기록부터 정리하도록 안내해요. 아이폰은 홈 화면에 추가해 쓰면 오래 안 써도
          데이터가 지워지지 않아요.
        </p>
      </div>
      <SheetItem
        icon={<Eraser size={18} />}
        label="오래된 기록 정리"
        hint="1년·6개월 이전 또는 가장 오래된 순"
        onClick={handleCleanup}
      />
      <SheetItem
        icon={<Trash2 size={18} />}
        label="데이터 지우기"
        hint="운동 기록만, 또는 전부 지우고 처음 상태로"
        danger
        onClick={handleReset}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportFile(f)
          e.target.value = ''
        }}
      />
    </Sheet>
  )
}
