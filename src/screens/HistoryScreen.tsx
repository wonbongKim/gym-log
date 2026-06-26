import { useRef, useState } from 'react'
import { Download, Upload, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '../components/Button'
import { useLogs } from '../hooks/useStores'
import { logStats } from '../lib/workout'
import {
  BackupError,
  downloadBackup,
  parseBackup,
  restoreBackup,
} from '../lib/backup'
import type { WorkoutLog } from '../types'
import { LogDetail } from './LogDetail'
import styles from './Screen.module.css'
import list from './HistoryScreen.module.css'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function dateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${iso.slice(5).replace('-', '.')} (${WEEK[d.getDay()]})`
}

export function HistoryScreen() {
  const { logs, remove } = useLogs()
  const [detail, setDetail] = useState<WorkoutLog | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      if (
        confirm(
          '가져온 데이터로 덮어쓸까요?\n현재 루틴·종목·기록이 모두 교체됩니다.',
        )
      ) {
        restoreBackup(backup)
        alert('복원이 완료되었습니다.')
      }
    } catch (e) {
      alert(e instanceof BackupError ? e.message : '가져오기에 실패했습니다.')
    }
  }

  const handleDelete = (log: WorkoutLog) => {
    if (confirm(`${log.date} 기록을 삭제할까요?`)) remove(log.id)
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>기록</h1>
      </header>

      {logs.length === 0 ? (
        <div className={styles.placeholder}>
          아직 운동 기록이 없어요.
          <br />
          루틴 탭에서 운동을 시작해 보세요.
        </div>
      ) : (
        <ul className={list.list}>
          {logs.map((log) => {
            const { totalSets, totalVolume } = logStats(log.exercises)
            return (
              <li key={log.id} className={list.card}>
                <button
                  className={list.cardMain}
                  onClick={() => setDetail(log)}
                >
                  <div className={list.cardTop}>
                    <span className={list.date}>{dateLabel(log.date)}</span>
                    <ChevronRight size={18} className={list.chevron} />
                  </div>
                  <h2 className={list.name}>{log.routineName}</h2>
                  <p className={list.meta}>
                    {log.exercises.length}종목 · {totalSets}세트
                    {totalVolume > 0 &&
                      ` · ${totalVolume.toLocaleString()}kg`}
                  </p>
                </button>
                <button
                  className={list.del}
                  onClick={() => handleDelete(log)}
                  aria-label="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={list.backup}>
        <span className={list.backupLabel}>백업</span>
        <div className={list.backupBtns}>
          <Button variant="ghost" block onClick={downloadBackup}>
            <Download size={18} /> 내보내기
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={18} /> 가져오기
          </Button>
        </div>
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
      </div>

      {detail && (
        <LogDetail log={detail} onClose={() => setDetail(null)} />
      )}
    </main>
  )
}
