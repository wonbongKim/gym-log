import { useEffect, useRef } from 'react'
import { Timer, SkipForward } from 'lucide-react'
import { useNow } from '../hooks/useNow'
import { formatClock } from '../lib/stats'
import { beep, vibrate } from '../lib/sound'
import type { RestTimer as RestTimerState } from '../types'
import styles from './RestTimer.module.css'

/** 운동 화면 하단에 떠 있는 휴식 타이머 */
export function RestTimer({
  rest,
  sound,
  onAdjust,
  onSkip,
  onOpenSettings,
}: {
  rest: RestTimerState
  sound: boolean
  onAdjust: (deltaSec: number) => void
  onSkip: () => void
  onOpenSettings: () => void
}) {
  const now = useNow(250)
  const endsAt = Date.parse(rest.endsAt)
  const remaining = Math.max(0, (endsAt - now) / 1000)
  const finished = remaining <= 0
  const progress = rest.duration > 0 ? 1 - remaining / rest.duration : 1

  // 최신 콜백/설정을 ref로 — effect가 매 틱 재실행되지 않도록
  const onSkipRef = useRef(onSkip)
  onSkipRef.current = onSkip
  const soundRef = useRef(sound)
  soundRef.current = sound

  // 종료 순간 1회만 알림, 잠시 보여준 뒤 자동으로 닫음
  const alertedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!finished) return
    // 너무 오래 지난 타이머(앱 복귀 등)는 조용히 닫기만
    const late = Date.now() - endsAt > 5000
    if (alertedFor.current !== rest.endsAt) {
      alertedFor.current = rest.endsAt
      if (!late) {
        vibrate()
        if (soundRef.current) beep()
      }
    }
    const id = window.setTimeout(() => onSkipRef.current(), late ? 0 : 2500)
    return () => window.clearTimeout(id)
  }, [finished, rest.endsAt, endsAt])

  return (
    <div className={`${styles.bar} ${finished ? styles.done : ''}`} role="timer" aria-live="off">
      <div className={styles.track} aria-hidden>
        <div className={styles.fill} style={{ transform: `scaleX(${Math.min(1, progress)})` }} />
      </div>
      <div className={styles.row}>
        <button className={styles.info} onClick={onOpenSettings} aria-label="휴식 시간 설정">
          <Timer size={18} className={styles.icon} />
          <span className={styles.label}>{finished ? '휴식 끝!' : '휴식'}</span>
          <span className={styles.clock}>{finished ? '다음 세트 💪' : formatClock(Math.ceil(remaining))}</span>
        </button>
        {!finished && (
          <div className={styles.controls}>
            <button className={styles.ctrl} onClick={() => onAdjust(-15)} aria-label="15초 줄이기">
              −15
            </button>
            <button className={styles.ctrl} onClick={() => onAdjust(15)} aria-label="15초 늘리기">
              +15
            </button>
            <button className={styles.skip} onClick={onSkip} aria-label="휴식 건너뛰기">
              <SkipForward size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
