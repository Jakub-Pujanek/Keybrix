import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
