import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { RoutinesScreen } from './screens/RoutinesScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { useSession } from './hooks/useStores'

/**
 * /workout: 진행 중 세션이 있을 때만 운동 화면, 없으면 홈으로.
 * 운동 종료 시엔 세션 삭제(동기)가 화면 이동(transition)보다 먼저 반영되므로,
 * 처음부터 세션이 없던 경우(직접 진입)만 즉시 리다이렉트하고
 * 도중에 사라진 경우는 이동이 끝나길 잠시 기다린다(다른 탭에서 종료한 경우 대비).
 */
function WorkoutRoute() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [hadSession] = useState(() => session != null)
  useEffect(() => {
    if (session || !hadSession) return
    const id = window.setTimeout(() => navigate('/', { replace: true }), 400)
    return () => window.clearTimeout(id)
  }, [session, hadSession, navigate])
  if (!session) return hadSession ? null : <Navigate to="/" replace />
  return <WorkoutScreen />
}

/** 탭(최상위 경로)이 바뀔 때만 맨 위로 — 오버레이를 열고 닫을 땐 목록 위치 유지 */
function useScrollTopOnTabChange(pathname: string) {
  const tab = pathname.split('/')[1] ?? ''
  const prev = useRef(tab)
  useEffect(() => {
    if (prev.current !== tab) window.scrollTo(0, 0)
    prev.current = tab
  }, [tab])
}

export default function App() {
  const location = useLocation()
  useScrollTopOnTabChange(location.pathname)
  // 운동 화면(풀스크린)에서는 하단 탭바를 숨긴다
  const showTabBar = location.pathname !== '/workout'

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/history/*" element={<HistoryScreen />} />
        <Route path="/routines/*" element={<RoutinesScreen />} />
        <Route path="/workout" element={<WorkoutRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabBar && <TabBar />}
    </div>
  )
}
