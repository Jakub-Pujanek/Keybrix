import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeybrixApi, MacroStatus } from '../../../shared/api'
import { useMacroStore } from './macro.store'

const createApiMock = (
  onMacroStatusChange: KeybrixApi['system']['onMacroStatusChange']
): KeybrixApi => ({
  macros: {
    getAll: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    save: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    delete: vi.fn(async () => true),
    toggle: vi.fn(async () => true),
    runManually: vi.fn(async () => ({
      runId: 'test',
      success: true,
      reasonCode: 'SUCCESS' as const
    })),
    stop: vi.fn(async () => ({
      runId: 'stop-test',
      success: true,
      reasonCode: 'ABORTED' as const
    }))
  },
  stats: {
    getDashboardStats: vi.fn(async () => ({
      totalAutomations: 0,
      timeSavedMinutes: 0,
      successRate: 0,
      activeNow: 0
    }))
  },
  logs: {
    getRecent: vi.fn(async () => []),
    onNewLog: vi.fn(() => vi.fn())
  },
  mousePicker: {
    start: vi.fn(async () => true),
    stop: vi.fn(async () => true),
    onPreviewUpdate: vi.fn(() => vi.fn()),
    onCoordinateSelected: vi.fn(() => vi.fn())
  },
  updater: {
    installNow: vi.fn(async () => false),
    onStateChange: vi.fn(() => vi.fn())
  },
  system: {
    getSessionInfo: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    getSessionDiagnostics: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    refreshSessionInfo: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    onStatusUpdate: vi.fn(() => vi.fn()),
    onMacroStatusChange
  },
  keyboard: {
    recordShortcut: vi.fn(async () => true)
  },
  settings: {
    get: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    update: vi.fn(async () => {
      throw new Error('not used in this test')
    })
  }
})

describe('macro.store subscribeMacroStatus', () => {
  beforeEach(() => {
    useMacroStore.setState({
      macros: [
        {
          id: 'macro-1',
          name: 'Test Macro',
          description: 'test',
          shortcut: 'CTRL+O',
          isActive: false,
          status: 'IDLE',
          blocksJson: {}
        }
      ],
      isLoading: false,
      loadError: null
    })
  })

  it('updates runtime status without changing isActive switch state', () => {
    let listener: ((id: string, status: MacroStatus) => void) | undefined

    window.api = createApiMock((callback) => {
      listener = callback
      return vi.fn()
    })

    const dispose = useMacroStore.getState().subscribeMacroStatus()
    expect(listener).toBeDefined()
    listener?.('macro-1', 'RUNNING')
    expect(useMacroStore.getState().macros[0]?.status).toBe('RUNNING')
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(false)

    listener?.('macro-1', 'ACTIVE')
    expect(useMacroStore.getState().macros[0]?.status).toBe('ACTIVE')
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(false)

    listener?.('macro-1', 'IDLE')
    expect(useMacroStore.getState().macros[0]?.status).toBe('IDLE')
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(false)

    dispose()
  })

  it('keeps manually armed switch ON across runtime status transitions', () => {
    useMacroStore.setState({
      macros: [
        {
          id: 'macro-1',
          name: 'Armed Macro',
          description: 'test',
          shortcut: 'CTRL+P',
          isActive: true,
          status: 'ACTIVE',
          blocksJson: {}
        }
      ]
    })

    let listener: ((id: string, status: MacroStatus) => void) | undefined
    window.api = createApiMock((callback) => {
      listener = callback
      return vi.fn()
    })

    const dispose = useMacroStore.getState().subscribeMacroStatus()
    expect(listener).toBeDefined()
    listener?.('macro-1', 'RUNNING')
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(true)

    listener?.('macro-1', 'IDLE')
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(true)

    dispose()
  })

  it('keeps existing switch value when loadMacros refreshes macro data', async () => {
    const getAllMock = vi.fn(async () => [
      {
        id: 'macro-1',
        name: 'Test Macro',
        description: 'test',
        shortcut: 'CTRL+O',
        isActive: false,
        status: 'IDLE' as const,
        blocksJson: {}
      }
    ])

    window.api = {
      ...createApiMock(() => vi.fn()),
      macros: {
        ...createApiMock(() => vi.fn()).macros,
        getAll: getAllMock
      }
    }

    useMacroStore.setState({
      macros: [
        {
          id: 'macro-1',
          name: 'Test Macro',
          description: 'test',
          shortcut: 'CTRL+O',
          isActive: true,
          status: 'RUNNING',
          blocksJson: {}
        }
      ]
    })

    await useMacroStore.getState().loadMacros()

    expect(getAllMock).toHaveBeenCalledTimes(1)
    expect(useMacroStore.getState().macros[0]?.isActive).toBe(true)
  })
})
