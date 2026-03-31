import AppLayout from './components/layout/AppLayout'
import DashboardScreen from './components/screens/DashboardScreen'
import EditorScreen from './components/screens/EditorScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import { useAppStore } from './store'

function App(): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)

  return (
    <AppLayout>
      {activeScreen === 'dashboard' ? <DashboardScreen /> : null}
      {activeScreen === 'editor' ? <EditorScreen /> : null}
      {activeScreen === 'settings' ? <SettingsScreen /> : null}
    </AppLayout>
  )
}

export default App
