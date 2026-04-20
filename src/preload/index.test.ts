import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/api'

const onMock = vi.fn()
const removeListenerMock = vi.fn()
const invokeMock = vi.fn()

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock
  }
}))

vi.mock('@electron-toolkit/preload', () => ({
  electronAPI: {}
}))

describe('preload api bridge', () => {
  const getApi = (): {
    system: {
      getSessionInfo: () => Promise<unknown>
      getSessionDiagnostics: () => Promise<unknown>
      refreshSessionInfo: () => Promise<unknown>
    }
    logs: {
      getRecent: () => Promise<unknown[]>
      onNewLog: (callback: (log: unknown) => void) => () => void
    }
    mousePicker: {
      start: () => Promise<boolean>
      stop: () => Promise<boolean>
      onPreviewUpdate: (callback: (payload: unknown) => void) => () => void
      onCoordinateSelected: (callback: (payload: unknown) => void) => () => void
    }
    macros: {
      getAll: () => Promise<unknown[]>
      getById: (id: string) => Promise<unknown>
      save: (input: Record<string, unknown>) => Promise<unknown>
      delete: (id: string) => Promise<boolean>
      toggle: (id: string, isActive: boolean) => Promise<boolean>
      runManually: (id: string, context?: { attemptId?: string }) => Promise<unknown>
      stop: (id: string, context?: { attemptId?: string }) => Promise<unknown>
    }
  } =>
    (window as unknown as { api: unknown }).api as {
      system: {
        getSessionInfo: () => Promise<unknown>
        getSessionDiagnostics: () => Promise<unknown>
        refreshSessionInfo: () => Promise<unknown>
      }
      logs: {
        getRecent: () => Promise<unknown[]>
        onNewLog: (callback: (log: unknown) => void) => () => void
      }
      mousePicker: {
        start: () => Promise<boolean>
        stop: () => Promise<boolean>
        onPreviewUpdate: (callback: (payload: unknown) => void) => () => void
        onCoordinateSelected: (callback: (payload: unknown) => void) => () => void
      }
      macros: {
        getAll: () => Promise<unknown[]>
        getById: (id: string) => Promise<unknown>
        save: (input: Record<string, unknown>) => Promise<unknown>
        delete: (id: string) => Promise<boolean>
        toggle: (id: string, isActive: boolean) => Promise<boolean>
        runManually: (id: string, context?: { attemptId?: string }) => Promise<unknown>
        stop: (id: string, context?: { attemptId?: string }) => Promise<unknown>
      }
    }
  it('invokes system.getSessionInfo channel and returns parsed payload', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      sessionType: 'X11',
      rawSession: 'x11',
      detectedAt: '2026-04-08T20:00:00.000Z',
      isInputInjectionSupported: true,
      detectionSource: 'LOGINCTL',
      detectionConfidence: 'HIGH'
    })

    await import('./index')
    const result = await getApi().system.getSessionInfo()

    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.system.getSessionInfo)
    expect(result).toEqual({
      sessionType: 'X11',
      rawSession: 'x11',
      detectedAt: '2026-04-08T20:00:00.000Z',
      isInputInjectionSupported: true,
      detectionSource: 'LOGINCTL',
      detectionConfidence: 'HIGH'
    })
  })

  it('accepts PROCESS_PLATFORM detection source in session info payload', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      sessionType: 'X11',
      rawSession: 'windows',
      detectedAt: '2026-04-09T18:30:00.000Z',
      isInputInjectionSupported: true,
      detectionSource: 'PROCESS_PLATFORM',
      detectionConfidence: 'MEDIUM'
    })

    await import('./index')
    const result = await getApi().system.getSessionInfo()

    expect(result).toEqual({
      sessionType: 'X11',
      rawSession: 'windows',
      detectedAt: '2026-04-09T18:30:00.000Z',
      isInputInjectionSupported: true,
      detectionSource: 'PROCESS_PLATFORM',
      detectionConfidence: 'MEDIUM'
    })
  })

  it('invokes system.getSessionDiagnostics channel and returns parsed payload', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      sessionInfo: {
        sessionType: 'X11',
        rawSession: 'x11',
        detectedAt: '2026-04-08T20:01:30.000Z',
        isInputInjectionSupported: true,
        detectionSource: 'LOGINCTL',
        detectionConfidence: 'HIGH'
      },
      snapshot: {
        xdgSessionType: 'x11',
        waylandDisplay: null,
        display: ':0',
        desktopSession: 'ubuntu-xorg',
        xdgSessionDesktop: 'ubuntu-xorg',
        gdmSession: 'ubuntu-xorg',
        sessionId: '2',
        loginctlSessionType: 'x11'
      },
      probes: [
        {
          step: 'loginctlSessionType',
          signal: 'x11',
          matched: true,
          note: 'Resolved from loginctl session metadata.'
        }
      ]
    })

    await import('./index')
    const result = await getApi().system.getSessionDiagnostics()

    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.system.getSessionDiagnostics)
    expect((result as { sessionInfo: { sessionType: string } }).sessionInfo.sessionType).toBe('X11')
  })

  it('invokes system.refreshSessionInfo channel and returns parsed payload', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      previousSessionType: 'WAYLAND',
      sessionInfo: {
        sessionType: 'X11',
        rawSession: 'x11',
        detectedAt: '2026-04-08T20:01:00.000Z',
        isInputInjectionSupported: true,
        detectionSource: 'LOGINCTL',
        detectionConfidence: 'HIGH'
      },
      changed: true
    })

    await import('./index')
    const result = await getApi().system.refreshSessionInfo()

    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.system.refreshSessionInfo)
    expect(result).toEqual({
      previousSessionType: 'WAYLAND',
      sessionInfo: {
        sessionType: 'X11',
        rawSession: 'x11',
        detectedAt: '2026-04-08T20:01:00.000Z',
        isInputInjectionSupported: true,
        detectionSource: 'LOGINCTL',
        detectionConfidence: 'HIGH'
      },
      changed: true
    })
  })

  it('throws when system.getSessionInfo payload is malformed', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      sessionType: 'BROKEN',
      rawSession: 'x11',
      detectedAt: '2026-04-08T20:00:00.000Z',
      isInputInjectionSupported: true,
      detectionSource: 'LOGINCTL',
      detectionConfidence: 'HIGH'
    })

    await import('./index')

    await expect(getApi().system.getSessionInfo()).rejects.toThrow()
  })

  it('throws when system.refreshSessionInfo payload is malformed', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce({
      previousSessionType: 'X11',
      sessionInfo: {
        sessionType: 'X11',
        rawSession: 'x11',
        detectedAt: 'invalid-date',
        isInputInjectionSupported: true,
        detectionSource: 'LOGINCTL',
        detectionConfidence: 'HIGH'
      },
      changed: false
    })

    await import('./index')

    await expect(getApi().system.refreshSessionInfo()).rejects.toThrow()
  })

  beforeEach(() => {
    vi.resetModules()
    invokeMock.mockReset()
    onMock.mockReset()
    removeListenerMock.mockReset()
  })

  it('maps logs subscription and cleanup to ipcRenderer on/removeListener', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false

    await import('./index')
    const off = getApi().logs.onNewLog(() => undefined)

    expect(onMock).toHaveBeenCalledWith(IPC_CHANNELS.logs.newLog, expect.any(Function))

    off()

    const listener = onMock.mock.calls[0]?.[1]
    expect(removeListenerMock).toHaveBeenCalledWith(IPC_CHANNELS.logs.newLog, listener)
  })

  it('maps mouse picker start/stop and subscriptions to ipcRenderer', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValueOnce(true).mockResolvedValueOnce(true)

    await import('./index')
    const api = getApi()

    const offPreview = api.mousePicker.onPreviewUpdate(() => undefined)
    const offSelected = api.mousePicker.onCoordinateSelected(() => undefined)
    const started = await api.mousePicker.start()
    const stopped = await api.mousePicker.stop()

    expect(started).toBe(true)
    expect(stopped).toBe(true)
    expect(onMock).toHaveBeenCalledWith(
      IPC_CHANNELS.mousePicker.previewUpdate,
      expect.any(Function)
    )
    expect(onMock).toHaveBeenCalledWith(
      IPC_CHANNELS.mousePicker.coordinateSelected,
      expect.any(Function)
    )
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.mousePicker.start)
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.mousePicker.stop)

    offPreview()
    offSelected()
    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC_CHANNELS.mousePicker.previewUpdate,
      onMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.mousePicker.previewUpdate)?.[1]
    )
    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC_CHANNELS.mousePicker.coordinateSelected,
      onMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.mousePicker.coordinateSelected)?.[1]
    )
  })

  it('invokes macros.run channel for manual run', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockResolvedValue({
      runId: 'run-1',
      success: true,
      reasonCode: 'SUCCESS'
    })

    await import('./index')
    const result = await getApi().macros.runManually('macro-123')

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.macros.run,
      expect.objectContaining({ id: 'macro-123' })
    )
    expect(result).toEqual({
      runId: 'run-1',
      success: true,
      reasonCode: 'SUCCESS'
    })
  })

  it('returns IPC_ERROR result when macros.run invoke rejects', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false
    invokeMock.mockRejectedValueOnce(new Error('invoke failed'))

    await import('./index')
    const result = (await getApi().macros.runManually('macro-123', {
      attemptId: 'attempt-1'
    })) as {
      runId: string
      success: boolean
      reasonCode: string
      debugMessage?: string
    }

    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('IPC_ERROR')
    expect(typeof result.debugMessage).toBe('string')
    expect(result.debugMessage).toBeDefined()
    expect(result.debugMessage!.length).toBeGreaterThan(0)
    expect(typeof result.runId).toBe('string')
    expect(result.runId.length).toBeGreaterThan(0)
  })

  it('maps macros CRUD channels to ipcRenderer.invoke', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false

    invokeMock
      .mockResolvedValueOnce([
        {
          id: 'macro-1',
          name: 'Macro 1',
          shortcut: 'CTRL+1',
          isActive: false,
          status: 'IDLE',
          blocksJson: { nodes: [], zoom: 1 }
        }
      ])
      .mockResolvedValueOnce({
        id: 'macro-1',
        name: 'Macro 1',
        shortcut: 'CTRL+1',
        isActive: false,
        status: 'IDLE',
        blocksJson: { nodes: [], zoom: 1 }
      })
      .mockResolvedValueOnce({
        id: 'macro-1',
        name: 'Macro 1 updated',
        shortcut: 'CTRL+2',
        isActive: false,
        status: 'IDLE',
        blocksJson: { nodes: [], zoom: 1 }
      })
      .mockResolvedValueOnce({
        runId: 'stop-1',
        success: true,
        reasonCode: 'ABORTED'
      })
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    await import('./index')
    const api = getApi()

    await api.macros.getAll()
    await api.macros.getById('macro-1')
    await api.macros.save({
      id: 'macro-1',
      name: 'Macro 1 updated',
      shortcut: 'CTRL+2',
      isActive: false,
      status: 'IDLE',
      blocksJson: { nodes: [], zoom: 1 }
    })
    await api.macros.stop('macro-1')
    await api.macros.toggle('macro-1', true)
    await api.macros.delete('macro-1')

    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.macros.getAll)
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.macros.getById, 'macro-1')
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.macros.save,
      expect.objectContaining({ id: 'macro-1', shortcut: 'CTRL+2' })
    )
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.macros.stop,
      expect.objectContaining({ id: 'macro-1' })
    )
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.macros.toggle, 'macro-1', true)
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.macros.delete, 'macro-1')
  })

  it('passes commands-first blocksJson through save even when nodes are invalid', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false

    const commands = [
      { type: 'WAIT', payload: { durationMs: 5 } },
      { type: 'TYPE_TEXT', payload: { text: 'from-preload' } }
    ]

    invokeMock.mockResolvedValueOnce({
      id: 'macro-cmds',
      name: 'Commands First',
      shortcut: 'CTRL+SHIFT+C',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: {
        commands,
        nodes: [
          {
            id: 'broken-node',
            type: 'TYPE_TEXT',
            x: 0,
            y: 0,
            nextId: null,
            payload: { text: 'invalid-nodes' }
          }
        ]
      }
    })

    await import('./index')

    await getApi().macros.save({
      id: 'macro-cmds',
      name: 'Commands First',
      shortcut: 'CTRL+SHIFT+C',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: {
        commands,
        nodes: [
          {
            id: 'broken-node',
            type: 'TYPE_TEXT',
            x: 0,
            y: 0,
            nextId: null,
            payload: { text: 'invalid-nodes' }
          }
        ]
      }
    })

    const saveCall = invokeMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.macros.save)
    const payload = saveCall?.[1] as { blocksJson?: Record<string, unknown> } | undefined

    expect(payload?.blocksJson?.['commands']).toEqual(commands)
  })

  it('normalizes shortcut formatting before save invoke', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false

    invokeMock.mockResolvedValueOnce({
      id: 'macro-shortcut',
      name: 'Shortcut Normalize',
      shortcut: 'CTRL+SHIFT+K',
      isActive: false,
      status: 'IDLE',
      blocksJson: { nodes: [], zoom: 1 }
    })

    await import('./index')
    await getApi().macros.save({
      id: 'macro-shortcut',
      name: 'Shortcut Normalize',
      shortcut: ' ctrl   + shift + k ',
      isActive: false,
      status: 'IDLE',
      blocksJson: { nodes: [], zoom: 1 }
    })

    const saveCall = invokeMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.macros.save)
    expect(saveCall?.[1]).toEqual(expect.objectContaining({ shortcut: 'CTRL+SHIFT+K' }))
  })

  it('drops malformed log entries instead of throwing in logs.getRecent', async () => {
    ;(process as { contextIsolated?: boolean }).contextIsolated = false

    invokeMock.mockResolvedValueOnce([
      {
        id: 'log-1',
        timestamp: '[10:00:00]',
        level: 'INFO',
        message: 'ok'
      },
      {
        id: 'log-2',
        timestamp: '[10:00:01]',
        level: 'BAD_LEVEL',
        message: 'bad'
      }
    ])

    await import('./index')
    const logs = await getApi().logs.getRecent()

    expect(logs).toEqual([
      {
        id: 'log-1',
        timestamp: '[10:00:00]',
        level: 'INFO',
        message: 'ok'
      }
    ])
  })
})
