import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
  addEventListener: (type: 'release', cb: () => void) => void
}

/** 운동 중 화면 꺼짐 방지 (Screen Wake Lock API, 미지원 브라우저는 무시) */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> }
    }).wakeLock
    if (!enabled || !wl) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return
      try {
        const s = await wl.request('screen')
        if (cancelled) {
          s.release().catch(() => {})
          return
        }
        sentinel = s
        s.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        // 권한 거부/저전력 모드 등 — 조용히 무시
      }
    }

    // 탭이 백그라운드로 가면 자동 해제되므로 복귀 시 재요청
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [enabled])
}
