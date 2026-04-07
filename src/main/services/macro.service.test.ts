import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeThemeMock = { themeSource: 'dark' as 'dark' | 'light' }
const appMock = {
  setLoginItemSettings: vi.fn()
}
const globalShortcutMock = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false)
}

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

describe('MacroService', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
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

    macroService.save({
      name: 'Macro 1',
      shortcut: 'CTRL+R',
      blocksJson: { nodes: [], zoom: 1 }
    })

    expect(macroService.reserveShortcut({ keys: 'CTRL+X', source: 'topbar' })).toBe(true)
    expect(macroService.reserveShortcut({ keys: 'CTRL + R', source: 'topbar' })).toBe(false)
  })

  it('runs macro via main runtime flow when global master is enabled', async () => {
    const { macroService } = await import('./macro.service')

    const saved = macroService.save({
      name: 'Run Me',
      shortcut: 'CTRL+SHIFT+R',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const result = await macroService.run(saved.id)

    expect(result).toBe(true)
    expect(macroService.getById(saved.id)?.status).toBe('ACTIVE')
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

    expect(result).toBe(false)
    expect(macroService.getById(saved.id)?.status).toBe('IDLE')
  })
})
