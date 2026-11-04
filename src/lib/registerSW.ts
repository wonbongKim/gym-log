/** 서비스 워커 등록 (프로덕션 빌드에서만) — 홈 화면 설치 + 오프라인 실행 지원 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const register = () => {
    const base = import.meta.env.BASE_URL // '/gym-log/'
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch((err: unknown) => console.warn('서비스 워커 등록 실패:', err))
  }

  // 첫 로딩 성능에 영향 없도록 load 이후 등록 (이미 로드됐으면 바로)
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
