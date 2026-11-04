// 휴식 종료 알림 — 짧은 비프 + 진동.
// iOS는 사용자 제스처 안에서 AudioContext를 깨워둬야 나중에 소리가 난다.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

/** 사용자 탭 핸들러 안에서 호출 → 오디오 잠금 해제 */
export function primeAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function beep(): void {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime
  ;[0, 0.22].forEach((offset) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t0 + offset)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.16)
    osc.connect(gain).connect(c.destination)
    osc.start(t0 + offset)
    osc.stop(t0 + offset + 0.18)
  })
}

export function vibrate(pattern: number | number[] = [180, 90, 180]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 미지원
  }
}
