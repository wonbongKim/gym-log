import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { RoutinesScreen } from './screens/RoutinesScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { useSession } from './hooks/useStores'

/** /workout: 진행 중 세션이 있을 때만 운동 화면, 없으면 홈으로 */
function WorkoutRoute() {
  const { session } = useSession()
  if (!session) return <Navigate to="/" replace />
  return <WorkoutScreen />
}

export default function App() {
  const location = useLocation()
  // 운동 화면(풀스크린)에서는 하단 탭바를 숨긴다
  const showTabBar = location.pathname !== '/workout'

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/routines" element={<RoutinesScreen />} />
        <Route path="/workout" element={<WorkoutRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabBar && <TabBar />}
    </div>
  )
}
