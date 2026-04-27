import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { DEFAULT_APP_SETTINGS, type KeybrixApi, type RuntimeSessionInfo } from '../../shared/api'
import {
  useActivityStore,
  useAppStore,
  useMacroStore,
  useSessionStore,
  useSettingsStore,
  useUiStore,
  useUpdaterStore
} from './store'

type TestMacro = Awaited<ReturnType<KeybrixApi['macros']['getAll']>>[number]

const buildSessionInfo = (sessionType: RuntimeSessionInfo['sessionType']): RuntimeSessionInfo => ({
  sessionType,
  rawSession: sessionType.toLowerCase(),
  detectedAt: new Date().toISOString(),
  isInputInjectionSupported: sessionType === 'X11',
  detectionSource: sessionType === 'UNKNOWN' ? 'UNKNOWN' : 'LOGINCTL',
  detectionConfidence: sessionType === 'UNKNOWN' ? 'LOW' : 'HIGH'
})

const buildApiMock = (language: 'POLSKI' | 'ENGLISH' = 'ENGLISH'): KeybrixApi => {
  let sequence = 2

  let macros: TestMacro[] = [
    {
      id: 'macro-1',
      name: 'Starter Macro',
      description: 'seed macro',
      shortcut: 'CTRL+SHIFT+1',
      isActive: false,
      status: 'IDLE',
      blocksJson: {
        nodes: [],
        zoom: 1
      }
    }
  ]

  return {
    macros: {
      getAll: async () => [...macros],
      getById: async (id) => macros.find((macro) => macro.id === id) ?? null,
      save: async (input) => {
        if (input.id) {
          const existing = macros.find((macro) => macro.id === input.id)
          const updated: TestMacro = {
            id: input.id,
            name: input.name ?? existing?.name ?? 'Updated Macro',
            description: existing?.description ?? '',
            shortcut: input.shortcut ?? existing?.shortcut ?? 'CTRL+SHIFT+1',
            isActive: input.isActive ?? existing?.isActive ?? false,
            status: input.status ?? existing?.status ?? 'IDLE',
            blocksJson: input.blocksJson ?? existing?.blocksJson ?? { nodes: [], zoom: 1 }
          }

          macros = macros.map((macro) => (macro.id === input.id ? updated : macro))
          return updated
        }

        const created: TestMacro = {
          id: `macro-${sequence}`,
          name: input.name ?? 'Created Macro',
          description: '',
          shortcut: input.shortcut ?? 'CTRL+SHIFT+1',
          isActive: input.isActive ?? false,
          status: input.status ?? 'IDLE',
          blocksJson: input.blocksJson ?? { nodes: [], zoom: 1 }
        }

        sequence += 1
        macros = [created, ...macros]
        return created
      },
      delete: async (id) => {
        const before = macros.length
        macros = macros.filter((macro) => macro.id !== id)
        return macros.length < before
      },
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
        totalAutomations: macros.length,
        timeSavedMinutes: 0,
        successRate: 100,
        activeNow: macros.filter((macro) => macro.isActive).length
      })
    },
    logs: {
      getRecent: async () => [],
      onNewLog: () => () => {}
    },
    mousePicker: {
      start: async () => true,
      stop: async () => true,
      onPreviewUpdate: () => () => {},
      onCoordinateSelected: () => () => {}
    },
    updater: {
      installNow: async () => true,
      onStateChange: () => () => {}
    },
    system: {
      getSessionInfo: async () => buildSessionInfo('X11'),
      getSessionDiagnostics: async () => ({
        sessionInfo: buildSessionInfo('X11'),
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
      refreshSessionInfo: async () => ({
        previousSessionType: 'X11',
        sessionInfo: buildSessionInfo('X11'),
        changed: false
      }),
      onStatusUpdate: (callback) => {
        callback('OPTIMAL')
        return () => {}
      },
      onMacroStatusChange: () => () => {}
    },
    keyboard: {
      recordShortcut: async () => true
    },
    settings: {
      get: async () => ({
        ...DEFAULT_APP_SETTINGS,
        language
      }),
      update: async (patch) => ({
        ...DEFAULT_APP_SETTINGS,
        ...patch,
        language: patch.language ?? language
      })
    }
  }
}

describe('App regressions', () => {
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
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        language: 'ENGLISH'
      },
      isLoading: false,
      language: 'ENGLISH'
    })
    useUiStore.setState({
      isSidebarCompact: false,
      isCreateMacroModalOpen: false,
      isNotificationsPanelOpen: false,
      isHelpPanelOpen: false,
      deleteMacroConfirmTarget: null
    })
    useUpdaterStore.setState({
      updaterState: {
        status: 'IDLE',
        version: undefined
      },
      isToastVisible: false,
      isInstalling: false
    })

    window.api = buildApiMock('ENGLISH')
  })

  it('resets create-macro draft after create-delete-create flow', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Starter Macro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New Macro' }))

    const firstOpenInput = await screen.findByTestId('create-macro-name-input')
    expect(firstOpenInput).toHaveValue('')

    fireEvent.change(firstOpenInput, { target: { value: 'Temporary Macro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create macro' }))

    await waitFor(() => {
      expect(screen.getByText('Temporary Macro')).toBeInTheDocument()
    })

    const createdCardTitle = screen.getByText('Temporary Macro')
    const createdCard = createdCardTitle.closest('article')
    expect(createdCard).not.toBeNull()

    if (!createdCard) {
      throw new Error('Expected macro card wrapper for Temporary Macro')
    }

    fireEvent.click(within(createdCard).getByRole('button', { name: 'Delete macro' }))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByText('Temporary Macro')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New Macro' }))

    const secondOpenInput = await screen.findByTestId('create-macro-name-input')
    expect(secondOpenInput).toHaveValue('')

    fireEvent.change(secondOpenInput, { target: { value: 'Second Macro' } })
    expect(secondOpenInput).toHaveValue('Second Macro')
  })
})
