import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve
  }
}

const nativeThemeMock = { themeSource: 'dark' as 'dark' | 'light' }
const appMock = {
  setLoginItemSettings: vi.fn(),
  getPath: vi.fn(() => testUserDataDir)
}
const globalShortcutMock = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false)
}

let testUserDataDir = ''

class MockStore<T extends Record<string, unknown>> {
  private readonly data = new Map<string, unknown>()

  constructor(options: { defaults?: Partial<T> } = {}) {
    const defaults = options.defaults ?? {}
    for (const [key, value] of Object.entries(defaults)) {
      this.data.set(key, value)
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data.get(String(key)) as T[K]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data.set(String(key), value)
  }
}

vi.mock('electron-store', () => ({
  default: MockStore
}))

vi.mock('electron', () => ({
  app: appMock,
  nativeTheme: nativeThemeMock,
  globalShortcut: globalShortcutMock
}))

vi.mock('../macro-runner', () => ({
  macroRunner: {
    runMacro: vi.fn()
  }
}))

describe('MacroService', () => {
  beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-macro-service-'))
    rmSync(testUserDataDir, { recursive: true, force: true })

    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    const { macroRunner } = await import('../macro-runner')

    mainStore.setState(INITIAL_MAIN_STORE_STATE)
    vi.mocked(macroRunner.runMacro).mockResolvedValue({
      success: true,
      reasonCode: 'SUCCESS'
    })
  })

  it('rejects shortcut conflicts on save', async () => {
    const { macroService } = await import('./macro.service')

    macroService.save({
      name: 'Macro 1',
      shortcut: 'CTRL+ALT+M',
      blocksJson: { nodes: [], zoom: 1 }
    })

    expect(() =>
      macroService.save({
        name: 'Macro 2',
        shortcut: 'CTRL + ALT + M',
        blocksJson: { nodes: [], zoom: 1 }
      })
    ).toThrowError('Shortcut conflict detected.')
  })

  it('reserves available shortcut and rejects used one', async () => {
    const { macroService } = await import('./macro.service')

    const saved = macroService.save({
      name: 'Macro 1',
      shortcut: 'CTRL+R',
      blocksJson: { nodes: [], zoom: 1 }
    })

    expect(macroService.reserveShortcut({ keys: 'CTRL+X', source: 'topbar' })).toEqual({
      success: true,
      reasonCode: 'OK'
    })
    expect(macroService.reserveShortcut({ keys: 'CTRL + R', source: 'topbar' })).toEqual({
      success: false,
      reasonCode: 'CONFLICT',
      conflictMacroName: 'Macro 1'
    })
    expect(macroService.reserveShortcut({ keys: 'CTRL + R', source: 'topbar', macroId: saved.id })).toEqual({
      success: true,
      reasonCode: 'OK'
    })
    expect(macroService.reserveShortcut({ keys: 'CTRL+O+P', source: 'topbar' })).toEqual({
      success: false,
      reasonCode: 'UNSUPPORTED_FORMAT'
    })
    expect(macroService.reserveShortcut({ keys: 'X', source: 'topbar' })).toEqual({
      success: false,
      reasonCode: 'UNSUPPORTED_FORMAT'
    })
  })

  it('rejects invalid global shortcut format on save', async () => {
    const { macroService } = await import('./macro.service')

    expect(() =>
      macroService.save({
        name: 'Invalid Shortcut',
        shortcut: 'CTRL+O+P',
        blocksJson: { nodes: [], zoom: 1 }
      })
    ).toThrowError('Invalid shortcut format. Use modifiers plus exactly one key.')
  })

  it('runs macro via main runtime flow when global master is enabled', async () => {
    const { macroService } = await import('./macro.service')

    const saved = macroService.save({
      name: 'Run Me',
      shortcut: 'CTRL+SHIFT+R',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const result = await macroService.run(saved.id)

    expect(result.success).toBe(true)
    expect(result.runId).toBeTruthy()
    expect(macroService.getById(saved.id)?.status).toBe('ACTIVE')
  })

  it('ignores shortcut trigger when macro is not active', async () => {
    const { macroService } = await import('./macro.service')

    const saved = macroService.save({
      name: 'Shortcut Start',
      shortcut: 'CTRL+SHIFT+Y',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const result = await macroService.triggerByShortcut(saved.id)

    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('NOT_RUNNING')
    expect(macroService.getById(saved.id)?.status).toBe('IDLE')
  })

  it('passes commands-first payload to runner when nodes are invalid', async () => {
    const { macroService } = await import('./macro.service')
    const { macroRunner } = await import('../macro-runner')

    vi.mocked(macroRunner.runMacro).mockClear()

    const saved = macroService.save({
      name: 'Commands First Service',
      shortcut: 'CTRL+SHIFT+C',
      blocksJson: {
        commands: [{ type: 'TYPE_TEXT', payload: { text: 'service-commands' } }],
        nodes: [
          {
            id: 'broken-node',
            type: 'TYPE_TEXT',
            x: 0,
            y: 0,
            nextId: null,
            payload: { text: 'invalid-graph' }
          }
        ]
      }
    })

    vi.mocked(macroRunner.runMacro).mockResolvedValueOnce({
      success: true,
      reasonCode: 'SUCCESS'
    })

    const result = await macroService.run(saved.id)

    expect(result.success).toBe(true)
    expect(result.runId).toBeTruthy()
    expect(macroRunner.runMacro).toHaveBeenCalledTimes(1)

    const runInput = vi.mocked(macroRunner.runMacro).mock.calls[0]?.[0]
    expect(runInput?.macro.blocksJson['commands']).toEqual([
      { type: 'TYPE_TEXT', payload: { text: 'service-commands' } }
    ])
  })

  it('blocks run when global master is disabled', async () => {
    const { macroService } = await import('./macro.service')
    const { settingsService } = await import('./settings.service')

    const saved = macroService.save({
      name: 'Blocked Run',
      shortcut: 'CTRL+SHIFT+B',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    settingsService.update({ globalMaster: false })
    const result = await macroService.run(saved.id)

    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('GLOBAL_MASTER_OFF')
    expect(result.runId).toBeTruthy()
    expect(macroService.getById(saved.id)?.status).toBe('IDLE')
  })

  it('keeps shortcut arm state enabled when run fails', async () => {
    const { macroService } = await import('./macro.service')
    const { macroRunner } = await import('../macro-runner')

    const saved = macroService.save({
      name: 'Failed Run Keeps Arm',
      shortcut: 'CTRL+SHIFT+K',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    vi.mocked(macroRunner.runMacro).mockResolvedValueOnce({
      success: false,
      reasonCode: 'RUNNER_FAILED'
    })

    const result = await macroService.run(saved.id)
    const updated = macroService.getById(saved.id)

    expect(result.success).toBe(false)
    expect(updated?.status).toBe('IDLE')
    expect(updated?.isActive).toBe(true)
  })

  it('cancels active run when macro is deleted during execution', async () => {
    const { macroService } = await import('./macro.service')
    const { macroRunner } = await import('../macro-runner')
    const deferred = createDeferred<{ success: boolean; reasonCode: 'SUCCESS' }>()

    vi.mocked(macroRunner.runMacro).mockReturnValueOnce(deferred.promise)

    const saved = macroService.save({
      name: 'Delete During Run',
      shortcut: 'CTRL+SHIFT+D',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const runPromise = macroService.run(saved.id)
    const deleted = macroService.delete(saved.id)

    deferred.resolve({ success: true, reasonCode: 'SUCCESS' })
    const runResult = await runPromise

    expect(deleted).toBe(true)
    expect(runResult.success).toBe(false)
    expect(runResult.reasonCode).toBe('ABORTED')
    expect(runResult.runId).toBeTruthy()
    expect(macroService.getById(saved.id)).toBeNull()
  })

  it('toggles running macro off when shortcut is triggered again', async () => {
    const { macroService } = await import('./macro.service')
    const { macroRunner } = await import('../macro-runner')
    const deferred = createDeferred<{ success: boolean; reasonCode: 'SUCCESS' }>()

    vi.mocked(macroRunner.runMacro).mockReturnValueOnce(deferred.promise)

    const saved = macroService.save({
      name: 'Shortcut Toggle Run',
      shortcut: 'CTRL+SHIFT+T',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const firstTriggerPromise = macroService.triggerByShortcut(saved.id)
    const secondTriggerResult = await macroService.triggerByShortcut(saved.id)

    deferred.resolve({ success: true, reasonCode: 'SUCCESS' })
    const firstTriggerResult = await firstTriggerPromise

    expect(secondTriggerResult.success).toBe(false)
    expect(secondTriggerResult.reasonCode).toBe('ABORTED')
    expect(firstTriggerResult.success).toBe(false)
    expect(firstTriggerResult.reasonCode).toBe('ABORTED')
  })

  it('stops running macro via explicit stop API', async () => {
    const { macroService } = await import('./macro.service')
    const { macroRunner } = await import('../macro-runner')
    const deferred = createDeferred<{ success: boolean; reasonCode: 'SUCCESS' }>()

    vi.mocked(macroRunner.runMacro).mockReturnValueOnce(deferred.promise)

    const saved = macroService.save({
      name: 'Explicit Stop',
      shortcut: 'CTRL+SHIFT+S',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const runPromise = macroService.run(saved.id)
    const stopResult = macroService.stop(saved.id)

    deferred.resolve({ success: true, reasonCode: 'SUCCESS' })
    const runResult = await runPromise

    expect(stopResult.success).toBe(true)
    expect(stopResult.reasonCode).toBe('ABORTED')
    expect(runResult.success).toBe(false)
    expect(runResult.reasonCode).toBe('ABORTED')
  })

  it('reconciles stale runtime status on startup', async () => {
    const { macroService } = await import('./macro.service')

    const activeMacro = macroService.save({
      name: 'Startup Active',
      shortcut: 'CTRL+SHIFT+A',
      isActive: true,
      status: 'IDLE',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const idleMacro = macroService.save({
      name: 'Startup Idle',
      shortcut: 'CTRL+SHIFT+I',
      isActive: false,
      status: 'RUNNING',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    macroService.reconcileRuntimeStatuses()

    expect(macroService.getById(activeMacro.id)?.status).toBe('ACTIVE')
    expect(macroService.getById(idleMacro.id)?.status).toBe('IDLE')
  })

  it('saves macro as disabled when global shortcut registration fails', async () => {
    const { macroService } = await import('./macro.service')

    globalShortcutMock.register.mockReturnValueOnce(false)

    const saved = macroService.save({
      name: 'Unavailable Shortcut',
      shortcut: 'CTRL+SHIFT+U',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: { commands: [{ type: 'WAIT', payload: { durationMs: 0 } }] }
    })

    expect(saved.isActive).toBe(false)
    expect(saved.status).toBe('IDLE')
  })
})
