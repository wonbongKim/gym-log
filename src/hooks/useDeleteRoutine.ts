import { useCallback } from 'react'
import { useRoutines } from './useStores'
import { useDialog } from '../components/DialogProvider'
import type { Routine } from '../types'

/** 루틴 삭제 (확인 → 삭제 → 되돌리기 토스트). 삭제했으면 true */
export function useDeleteRoutine() {
  const { routines, remove, restore } = useRoutines()
  const { confirm, toast } = useDialog()

  return useCallback(
    async (r: Routine): Promise<boolean> => {
      const ok = await confirm({
        title: `'${r.name}' 루틴을 삭제할까요?`,
        message: '지난 운동 기록은 그대로 남아요.',
        confirmText: '삭제',
        danger: true,
      })
      if (!ok) return false
      const index = routines.findIndex((x) => x.id === r.id)
      remove(r.id)
      toast('루틴을 삭제했어요', {
        action: { label: '되돌리기', onClick: () => restore(r, index) },
      })
      return true
    },
    [routines, remove, restore, confirm, toast],
  )
}
