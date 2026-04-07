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

describe('MacroRepository', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('saves and returns macro with generated id', async () => {
    const { macroRepository } = await import('./macro.repository')

    const saved = macroRepository.save({
      name: 'Test Macro',
      shortcut: 'CTRL+ALT+M',
      blocksJson: { nodes: [], zoom: 1 }
    })

    expect(saved.id).toBeTruthy()
    expect(saved.name).toBe('Test Macro')

    const all = macroRepository.getAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.id).toBe(saved.id)
  })

  it('deletes macro from byId and order', async () => {
    const { macroRepository } = await import('./macro.repository')

    const saved = macroRepository.save({
      name: 'Delete Me',
      shortcut: 'CTRL+X',
      blocksJson: { nodes: [], zoom: 1 }
    })

    const deleted = macroRepository.delete(saved.id)

    expect(deleted).toBe(true)
    expect(macroRepository.getById(saved.id)).toBeNull()
    expect(macroRepository.getAll()).toHaveLength(0)
  })

  it('toggles macro state and status', async () => {
    const { macroRepository } = await import('./macro.repository')

    const saved = macroRepository.save({
      name: 'Toggle Me',
      shortcut: 'CTRL+T',
      blocksJson: { nodes: [], zoom: 1 }
    })

    const toggled = macroRepository.toggleActive(saved.id, true)

    expect(toggled).toBe(true)
    expect(macroRepository.getById(saved.id)?.isActive).toBe(true)
    expect(macroRepository.getById(saved.id)?.status).toBe('ACTIVE')
  })
})
