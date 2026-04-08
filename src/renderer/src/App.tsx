import AppLayout from './components/layout/AppLayout'
import DashboardScreen from './components/screens/DashboardScreen'
import EditorScreen from './components/screens/EditorScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import WaylandGuideScreen from './components/screens/WaylandGuideScreen'
import { useEffect } from 'react'
import { useAppStore, useSessionStore } from './store'
import { useSettingsStore } from './store/settings.store'
import { useThemeSync } from './hooks/useThemeSync'

function App(): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)
  const loadAppSettings = useSettingsStore((state) => state.loadAppSettings)
  const loadSessionInfo = useSessionStore((state) => state.loadSessionInfo)
  const appSettings = useSettingsStore((state) => state.appSettings)

  const themeMode = appSettings?.themeMode ?? 'DARK'
  const accentColor = appSettings?.accentColor ?? 'blue'

  useThemeSync(themeMode, accentColor)

  useEffect(() => {
    void loadAppSettings()
    void loadSessionInfo()
  }, [loadAppSettings, loadSessionInfo])

  return (
    <AppLayout>
      {activeScreen === 'dashboard' ? <DashboardScreen /> : null}
      {activeScreen === 'editor' ? <EditorScreen /> : null}
      {activeScreen === 'settings' ? <SettingsScreen /> : null}
      {activeScreen === 'wayland-guide' ? <WaylandGuideScreen /> : null}
    </AppLayout>
  )
}

export default App
