import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { RoutinesScreen } from './screens/RoutinesScreen'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="app-shell">
      {tab === 'home' && <HomeScreen />}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'routines' && <RoutinesScreen />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
