import { storage } from '../storage'
import { localDate } from './stats'
import type { ExercisesStore, LogsStore, RoutinesStore } from '../types'

export class BackupError extends Error {}

export interface BackupFile {
  exportedAt?: string
  exercises: ExercisesStore
  routines: RoutinesStore
  logs: LogsStore
}

/** 텍스트를 파일로 내려받기 */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 일부 브라우저는 클릭 직후 revoke하면 다운로드가 취소됨
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 현재 데이터를 JSON 파일로 다운로드 */
export function downloadBackup(): void {
  downloadText(`gymlog-backup-${localDate()}.json`, storage.exportAll())
  try {
    const cur = storage.getSettings()
    storage.setSettings({
      ...cur,
      settings: { ...cur.settings, lastBackupAt: new Date().toISOString() },
    })
  } catch {
    // 용량이 가득 찬 상태에서도 다운로드 자체는 성공해야 한다
  }
}

/** 복원 확인 메시지용 요약 */
export function backupSummary(b: BackupFile): string {
  const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString('ko-KR') : '날짜 미상'
  return `${when} 백업 · 루틴 ${b.routines.routines.length}개 · 기록 ${b.logs.logs.length}개`
}

function isStore(v: unknown, listKey: string): boolean {
  return (
    !!v &&
    typeof v === 'object' &&
    'version' in (v as object) &&
    Array.isArray((v as Record<string, unknown>)[listKey])
  )
}

/** 백업 JSON 텍스트를 검증해 파싱 */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('올바른 JSON 파일이 아닙니다.')
  }
  if (!data || typeof data !== 'object') {
    throw new BackupError('백업 형식이 올바르지 않습니다.')
  }
  const obj = data as Record<string, unknown>
  if (
    !isStore(obj.exercises, 'exercises') ||
    !isStore(obj.routines, 'routines') ||
    !isStore(obj.logs, 'logs')
  ) {
    throw new BackupError(
      'exercises / routines / logs 데이터를 찾을 수 없습니다.',
    )
  }
  return obj as unknown as BackupFile
}

/** 백업을 현재 데이터에 덮어쓰기(복원) */
export function restoreBackup(backup: BackupFile): void {
  storage.setExercises(backup.exercises)
  storage.setRoutines(backup.routines)
  storage.setLogs(backup.logs)
}
