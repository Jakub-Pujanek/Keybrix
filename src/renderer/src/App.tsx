import AppLayout from './components/layout/AppLayout'
import DashboardScreen from './components/screens/DashboardScreen'
import EditorScreen from './components/screens/EditorScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import { useEffect } from 'react'
import { useAppStore } from './store'
import { useSettingsStore } from './store/settings.store'
import { useThemeSync } from './hooks/useThemeSync'

function App(): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)
  const loadAppSettings = useSettingsStore((state) => state.loadAppSettings)
  const appSettings = useSettingsStore((state) => state.appSettings)

  const themeMode = appSettings?.themeMode ?? 'DARK'
  const accentColor = appSettings?.accentColor ?? 'blue'

  useThemeSync(themeMode, accentColor)

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
