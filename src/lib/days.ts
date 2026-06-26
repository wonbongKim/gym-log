import type { WeekDay } from '../types'

export const WEEK_DAYS: { id: WeekDay; label: string }[] = [
  { id: 'mon', label: '월' },
  { id: 'tue', label: '화' },
  { id: 'wed', label: '수' },
  { id: 'thu', label: '목' },
  { id: 'fri', label: '금' },
  { id: 'sat', label: '토' },
  { id: 'sun', label: '일' },
]

/** Date.getDay()(0=일) → WeekDay */
export function todayWeekDay(d = new Date()): WeekDay {
  const map: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return map[d.getDay()]
}

export function formatDays(days: WeekDay[]): string {
  const order = WEEK_DAYS.map((w) => w.id)
  return [...days]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((d) => WEEK_DAYS.find((w) => w.id === d)?.label)
    .join('·')
}
