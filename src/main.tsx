import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { DialogProvider } from './components/DialogProvider'
import { registerServiceWorker } from './lib/registerSW'
import { reconcileExercises } from './lib/exerciseMigrate'
import './styles/global.css'

// 직접 추가했던 종목 중 기본 종목과 이름이 같은 것은 기본 종목으로 합친다 (기록·루틴 연결 유지)
try {
  reconcileExercises()
} catch (e) {
  console.warn('종목 정리를 건너뜀', e)
}

// 프로덕션 빌드에서만 오프라인 캐시용 서비스 워커 등록
registerServiceWorker()

// 브라우저가 저장 공간 부족 시 이 사이트 데이터를 임의로 지우지 않도록 요청 (지원 브라우저만)
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <DialogProvider>
        <App />
      </DialogProvider>
    </HashRouter>
  </StrictMode>,
)
