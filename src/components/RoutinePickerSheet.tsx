import { Dumbbell } from 'lucide-react'
import { Sheet, SheetItem } from './Sheet'
import { formatDays } from '../lib/days'
import type { Routine } from '../types'

/** 오늘 루틴이 아닐 때 다른 루틴을 골라 시작 */
export function RoutinePickerSheet({
  routines,
  onPick,
  onClose,
}: {
  routines: Routine[]
  onPick: (r: Routine) => void
  onClose: () => void
}) {
  return (
    <Sheet title="어떤 루틴으로 할까요?" onClose={onClose}>
      {routines.map((r) => (
        <SheetItem
          key={r.id}
          icon={<Dumbbell size={18} />}
          label={r.name}
          hint={`${formatDays(r.days) || '요일 없음'} · ${r.exercises.length}개 종목`}
          onClick={() => onPick(r)}
        />
      ))}
    </Sheet>
  )
}
