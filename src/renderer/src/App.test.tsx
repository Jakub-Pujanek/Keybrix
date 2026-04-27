import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import {
  DEFAULT_APP_SETTINGS,
  type KeybrixApi,
  type RuntimeSessionInfo,
  type UpdaterState
} from '../../shared/api'
import {
  useActivityStore,
  useAppStore,
  useMacroStore,
  useSessionStore,
  useSettingsStore,
  useUpdaterStore
} from './store'

let emitRealtimeLog: ((message: string) => void) | null = null
let initialSessionType: RuntimeSessionInfo['sessionType'] = 'X11'
let refreshSessionType: RuntimeSessionInfo['sessionType'] = 'X11'
let refreshPreviousSessionType: RuntimeSessionInfo['sessionType'] = 'X11'
let refreshCallCount = 0
let nextRefreshSessionFactory:
  | (() => Promise<{
      previousSessionType: RuntimeSessionInfo['sessionType']
      sessionInfo: RuntimeSessionInfo
      changed: boolean
    }>)
  | null = null
let emitUpdaterState: ((state: UpdaterState) => void) | null = null

const buildSessionInfo = (sessionType: RuntimeSessionInfo['sessionType']): RuntimeSessionInfo => ({
  sessionType,
  rawSession: sessionType.toLowerCase(),
  detectedAt: new Date().toISOString(),
  isInputInjectionSupported: sessionType === 'X11',
  detectionSource: sessionType === 'UNKNOWN' ? 'UNKNOWN' : 'LOGINCTL',
  detectionConfidence: sessionType === 'UNKNOWN' ? 'LOW' : 'HIGH'
})

const mockApi: KeybrixApi = {
  macros: {
    getAll: async () => [
      {
        id: 'macro-1',
        name: 'Copy & Paste Pro',
        description: 'mock',
        shortcut: 'CTRL+SHIFT+C',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {}
      }
    ],
    getById: async () => null,
    save: async () => {
      throw new Error('not used')
    },
    delete: async () => true,
    toggle: async () => true,
    runManually: async () => ({
      runId: 'run-test',
      success: true,
      reasonCode: 'SUCCESS'
    }),
    stop: async () => ({
      runId: 'run-stop-test',
      success: true,
      reasonCode: 'ABORTED'
    })
  },
  stats: {
    getDashboardStats: async () => ({
      totalAutomations: 42,
      timeSavedMinutes: 720,
      successRate: 99.8,
      activeNow: 4
    })
  },
  logs: {
    getRecent: async () => [
      {
        id: 'log-1',
        timestamp: '[14:02:11]',
        level: 'RUN',
        message: 'macro started'
      }
    ],
    onNewLog: (callback) => {
      emitRealtimeLog = (message: string) => {
        callback({
          id: `log-${Date.now()}`,
          timestamp: '[14:02:12]',
          level: 'INFO',
          message
        })
      }

      return () => {
        emitRealtimeLog = null
      }
    }
  },
  mousePicker: {
    start: async () => true,
    stop: async () => true,
    onPreviewUpdate: () => () => {},
    onCoordinateSelected: () => () => {}
  },
  updater: {
    installNow: async () => true,
    onStateChange: (callback) => {
      emitUpdaterState = callback
      return () => {
        emitUpdaterState = null
      }
    }
  },
  system: {
    getSessionInfo: async () => buildSessionInfo(initialSessionType),
    getSessionDiagnostics: async () => ({
      sessionInfo: buildSessionInfo(initialSessionType),
      snapshot: {
        xdgSessionType: null,
        waylandDisplay: null,
        display: null,
        desktopSession: null,
        xdgSessionDesktop: null,
        gdmSession: null,
        sessionId: null,
        loginctlSessionType: null
      },
      probes: []
    }),
    refreshSessionInfo: async () => {
      refreshCallCount += 1
      if (nextRefreshSessionFactory) {
        return nextRefreshSessionFactory()
      }

      return {
        previousSessionType: refreshPreviousSessionType,
        sessionInfo: buildSessionInfo(refreshSessionType),
        changed: refreshPreviousSessionType !== refreshSessionType
      }
    },
    onStatusUpdate: (callback) => {
      callback('OPTIMAL')
      return () => {}
    },
    onMacroStatusChange: () => () => {}
  },
  keyboard: {
    recordShortcut: async () => ({
      success: true,
      reasonCode: 'OK'
    }),
    setCaptureActive: async () => true
  },
  settings: {
    get: async () => ({
      launchAtStartup: true,
      minimizeToTrayOnClose: true,
      notifyOnMacroRun: true,
      language: 'POLSKI',
      globalMaster: true,
      delayMs: 0,
      stopOnError: true,
      themeMode: 'DARK',
      accentColor: 'blue'
    }),
    update: async (input) => ({
      launchAtStartup: input.launchAtStartup ?? true,
      minimizeToTrayOnClose: input.minimizeToTrayOnClose ?? true,
      notifyOnMacroRun: input.notifyOnMacroRun ?? true,
      language: input.language ?? 'POLSKI',
      globalMaster: input.globalMaster ?? true,
      delayMs: input.delayMs ?? 0,
      stopOnError: input.stopOnError ?? true,
      themeMode: input.themeMode ?? 'DARK',
      accentColor: input.accentColor ?? 'blue'
    })
  }
}

describe('App dashboard', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeScreen: 'dashboard',
      systemStatus: 'OPTIMAL',
      dashboardStats: null
    })
    useSessionStore.setState({
      sessionInfo: null,
      isChecking: false,
      lastBlockedAt: null,
      showSuccessUntil: null,
      guideReturnScreen: null
    })
    useMacroStore.setState({ macros: [], isLoading: false, loadError: null })
    useActivityStore.setState({ logs: [], isLoading: false })
    useSettingsStore.setState({
      appSettings: DEFAULT_APP_SETTINGS,
      isLoading: false,
      language: DEFAULT_APP_SETTINGS.language
    })

    initialSessionType = 'X11'
    refreshSessionType = 'X11'
    refreshPreviousSessionType = 'X11'
    refreshCallCount = 0
    nextRefreshSessionFactory = null
    window.api = mockApi
    emitRealtimeLog = null
    emitUpdaterState = null
  })

  afterEach(() => {
    vi.useRealTimers()
    emitRealtimeLog = null
  })

  it('should render configurable dashboard card', async () => {
    render(<App />)

    expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('99.8%')).toBeInTheDocument()
      expect(screen.getByText('Copy & Paste Pro')).toBeInTheDocument()
    })
  })

  it('should stream realtime activity logs', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('recent-activity-logs')).toBeInTheDocument()
    })

    act(() => {
      emitRealtimeLog?.('tick')
    })

    await waitFor(() => {
      expect(screen.getByText('tick')).toBeInTheDocument()
    })
  })

  it('shows update toast after downloaded state', async () => {
    useSettingsStore.setState({
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        language: 'ENGLISH'
      },
      isLoading: false,
      language: 'ENGLISH'
    })

    render(<App />)

    await waitFor(() => {
      expect(emitUpdaterState).not.toBeNull()
    })

    act(() => {
      emitUpdaterState?.({
        status: 'DOWNLOADED',
        version: '1.0.1'
      })
    })

    await waitFor(() => {
      expect(useUpdaterStore.getState().isToastVisible).toBe(true)
      expect(useUpdaterStore.getState().updaterState.status).toBe('DOWNLOADED')
      expect(useUpdaterStore.getState().updaterState.version).toBe('1.0.1')
    })
  })

  it('shows Wayland banner and opens guide screen', async () => {
    initialSessionType = 'WAYLAND'

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Wykryto sesje Wayland')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Jak przelaczyc na X11' }))

    await waitFor(() => {
      expect(screen.getByTestId('wayland-guide-screen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Wroc' }))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument()
    })
  })

  it('refreshes session from check-now and hides success banner after ttl', async () => {
    initialSessionType = 'WAYLAND'
    refreshPreviousSessionType = 'WAYLAND'
    refreshSessionType = 'X11'

    let resolveRefresh: (() => void) | null = null
    nextRefreshSessionFactory = () =>
      new Promise((resolve) => {
        resolveRefresh = () => {
          resolve({
            previousSessionType: 'WAYLAND',
            sessionInfo: buildSessionInfo('X11'),
            changed: true
          })
        }
      })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Wykryto sesje Wayland')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sprawdz sesje teraz' }))
    expect(refreshCallCount).toBe(1)

    await waitFor(() => {
      expect(screen.getByText('Sprawdzanie aktualnej sesji')).toBeInTheDocument()
    })

    await act(async () => {
      resolveRefresh?.()
    })

    await waitFor(() => {
      expect(screen.getByText('Potwierdzono sesje X11')).toBeInTheDocument()
    })

    act(() => {
      useSessionStore.setState({ showSuccessUntil: Date.now() + 10 })
    })

    await waitFor(
      () => {
        expect(screen.queryByText('Potwierdzono sesje X11')).not.toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })
})
