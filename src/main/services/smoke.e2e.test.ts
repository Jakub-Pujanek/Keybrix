import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const storeBuckets = new Map<string, Map<string, unknown>>()

class PersistentMockStore<T extends Record<string, unknown>> {
  private readonly bucket: Map<string, unknown>

  constructor(options: { name?: string; defaults?: Partial<T> } = {}) {
    const name = options.name ?? 'default'
    if (!storeBuckets.has(name)) {
      storeBuckets.set(name, new Map<string, unknown>())
    }

    this.bucket = storeBuckets.get(name) as Map<string, unknown>

    const defaults = options.defaults ?? {}
    for (const [key, value] of Object.entries(defaults)) {
      if (!this.bucket.has(key)) {
        this.bucket.set(key, value)
      }
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.bucket.get(String(key)) as T[K]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.bucket.set(String(key), value)
  }
}

const nativeThemeMock = { themeSource: 'dark' as 'dark' | 'light' }
let testUserDataDir = ''
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

vi.mock('electron-store', () => ({
  default: PersistentMockStore
}))

vi.mock('electron', () => ({
  app: appMock,
  nativeTheme: nativeThemeMock,
  globalShortcut: globalShortcutMock
}))

vi.mock('../macro-runner', () => ({
  macroRunner: {
    runMacro: vi.fn(async () => ({ success: true }))
  }
}))

describe('Main smoke e2e flows', () => {
  beforeEach(() => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-smoke-e2e-'))
    rmSync(testUserDataDir, { recursive: true, force: true })

    vi.resetModules()
    storeBuckets.clear()
    globalShortcutMock.register.mockClear()
    globalShortcutMock.unregister.mockClear()
    globalShortcutMock.unregisterAll.mockClear()
    globalShortcutMock.isRegistered.mockClear()
    globalShortcutMock.isRegistered.mockReturnValue(false)
  })

  it('create -> save -> toggle -> run updates logs and stats', async () => {
    const { macroService } = await import('./macro.service')
    const { logsService } = await import('./logs.service')
    const { statsService } = await import('./stats.service')

    const saved = macroService.save({
      name: 'Smoke Run',
      shortcut: 'CTRL+SHIFT+S',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    const toggled = macroService.toggle(saved.id, true)
    const runResult = await macroService.run(saved.id)

    expect(toggled).toBe(true)
    expect(runResult).toBe(true)
    expect(statsService.getCounters().totalRuns).toBe(1)
    expect(logsService.getRecent(10).some((log) => log.message.includes('saved.'))).toBe(true)
  })

  it('globalMaster OFF blocks run and toggle activation', async () => {
    const { macroService } = await import('./macro.service')
    const { settingsService } = await import('./settings.service')

    const saved = macroService.save({
      name: 'Blocked Smoke',
      shortcut: 'CTRL+SHIFT+B',
      blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
    })

    settingsService.update({ globalMaster: false })

    const toggleResult = macroService.toggle(saved.id, true)
    const runResult = await macroService.run(saved.id)

    expect(toggleResult).toBe(false)
    expect(runResult).toBe(false)
  })

  it('restart preserves macros, logs and stats from persistent stores', async () => {
    let macroId = ''

    {
      const { macroService } = await import('./macro.service')
      const { statsService } = await import('./stats.service')
      const { logsService } = await import('./logs.service')

      const saved = macroService.save({
        name: 'Persisted Macro',
        shortcut: 'CTRL+SHIFT+P',
        blocksJson: { commands: [{ type: 'WAIT', ms: 0 }] }
      })
      macroId = saved.id
      await macroService.run(saved.id)

      expect(statsService.getCounters().totalRuns).toBe(1)
      expect(logsService.getRecent(1).length).toBe(1)
    }

    vi.resetModules()

    {
      const { macroService } = await import('./macro.service')
      const { statsService } = await import('./stats.service')
      const { logsService } = await import('./logs.service')

      expect(macroService.getById(macroId)).not.toBeNull()
      expect(statsService.getCounters().totalRuns).toBe(1)
      expect(logsService.getRecent(1).length).toBe(1)
    }
  })

  it('restart keeps commands-first macro runnable', async () => {
    let macroId = ''
    const commands = [
      {
        type: 'WAIT',
        payload: { durationMs: 5 }
      },
      {
        type: 'TYPE_TEXT',
        payload: { text: 'persisted-run' }
      }
    ]

    {
      const { macroService } = await import('./macro.service')

      const saved = macroService.save({
        name: 'Commands First Persist',
        shortcut: 'CTRL+SHIFT+K',
        blocksJson: {
          commands,
          nodes: [
            {
              id: 'orphan-node',
              type: 'TYPE_TEXT',
              x: 10,
              y: 10,
              nextId: null,
              payload: { text: 'legacy-node-data' }
            }
          ],
          zoom: 1
        }
      })

      macroId = saved.id
    }

    vi.resetModules()

    {
      const { macroService } = await import('./macro.service')
      const { macroRunner } = await import('../macro-runner')

      vi.mocked(macroRunner.runMacro).mockClear()

      const persisted = macroService.getById(macroId)
      expect(persisted).not.toBeNull()
      expect(persisted?.blocksJson['commands']).toEqual(commands)

      const result = await macroService.run(macroId)

      expect(result).toBe(true)
      expect(macroRunner.runMacro).toHaveBeenCalledTimes(1)

      const runInput = vi.mocked(macroRunner.runMacro).mock.calls[0]?.[0]
      expect(runInput?.macro.blocksJson['commands']).toEqual(commands)
    }
  })
})
