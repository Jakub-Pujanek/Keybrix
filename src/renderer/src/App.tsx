import AppLayout from './components/layout/AppLayout'
import DashboardScreen from './components/screens/DashboardScreen'
import EditorScreen from './components/screens/EditorScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import { useEffect } from 'react'
import { useAppStore } from './store'
import { useSettingsStore } from './store/settings.store'

function App(): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)
  const loadAppSettings = useSettingsStore((state) => state.loadAppSettings)

  useEffect(() => {
    void loadAppSettings()
  }, [loadAppSettings])

  return (
    <AppLayout>
      {activeScreen === 'dashboard' ? <DashboardScreen /> : null}
      {activeScreen === 'editor' ? <EditorScreen /> : null}
      {activeScreen === 'settings' ? <SettingsScreen /> : null}
    </AppLayout>
  )
}

export default App
