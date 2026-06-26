import { useEffect, useRef, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { RoutinesScreen } from './screens/RoutinesScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { useSession } from './hooks/useStores'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const { session } = useSession()
  const [workoutOpen, setWorkoutOpen] = useState(false)

  // 새로 시작된 세션만 자동으로 연다. 앱 로드 시 이미 있던 세션은 홈의
  // '이어하기'로 두고 자동으로 열지 않는다(최초 startedAt을 기준값으로 초기화).
  const prevStart = useRef<string | undefined>(session?.startedAt)
  useEffect(() => {
    const s = session?.startedAt
    if (s && s !== prevStart.current) setWorkoutOpen(true)
    prevStart.current = s
  }, [session?.startedAt])

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <HomeScreen
          onNavigate={setTab}
          onResumeWorkout={() => setWorkoutOpen(true)}
        />
      )}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'routines' && <RoutinesScreen />}
      <TabBar active={tab} onChange={setTab} />
      {/* 진행 중 세션 + 열림 상태일 때만 풀스크린 표시(최소화 가능) */}
      {session && workoutOpen && (
        <WorkoutScreen onMinimize={() => setWorkoutOpen(false)} />
      )}
    </div>
  )
}
