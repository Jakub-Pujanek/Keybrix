import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  app: {
    getPath: vi.fn(() => testUserDataDir)
  }
}))

describe('MacroSeedService', () => {
  beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-macro-seed-'))
    rmSync(testUserDataDir, { recursive: true, force: true })

    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('creates My First Macro when missing', async () => {
    const { macroSeedService } = await import('./macro-seed.service')
    const { macroFilesStore } = await import('../store/macro-files.store')

    const result = macroSeedService.ensureMyFirstMacro()
    expect(result.created).toBe(true)

    const macro = macroFilesStore.readById('macro-my-first')
    expect(macro).not.toBeNull()
    expect(macro?.macro.name).toBe('My First Macro')
    expect(macro?.macro.blocksJson['nodes']).toBeTruthy()
  })

  it('does not overwrite an existing My First Macro', async () => {
    const { macroSeedService } = await import('./macro-seed.service')
    const { macroFilesStore } = await import('../store/macro-files.store')

    macroFilesStore.create({
      id: 'macro-my-first',
      name: 'My First Macro',
      shortcut: 'CTRL+ALT+1',
      isActive: true,
      status: 'ACTIVE',
      blocksJson: {
        zoom: 1,
        nodes: [
          {
            id: 'custom-start',
            type: 'START',
            x: 0,
            y: 0,
            nextId: null,
            payload: {
              shortcut: 'CTRL + ALT + 1'
            }
          }
        ]
      }
    })

    const result = macroSeedService.ensureMyFirstMacro()
    expect(result.created).toBe(false)

    const macro = macroFilesStore.readById('macro-my-first')
    expect(macro?.macro.shortcut).toBe('CTRL+ALT+1')
    expect(macro?.macro.isActive).toBe(true)
  })
})
