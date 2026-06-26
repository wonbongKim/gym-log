import { storage } from '../storage'
import { localDate } from './workout'
import type { ExercisesStore, LogsStore, RoutinesStore } from '../types'

export class BackupError extends Error {}

interface BackupFile {
  exportedAt?: string
  exercises: ExercisesStore
  routines: RoutinesStore
  logs: LogsStore
}

/** 현재 데이터를 JSON 파일로 다운로드 */
export function downloadBackup(): void {
  const json = storage.exportAll()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gymlog-backup-${localDate()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
