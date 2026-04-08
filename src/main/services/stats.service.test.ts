import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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

let testUserDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testUserDataDir)
  }
}))

describe('StatsService', () => {
  beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-stats-service-'))
    rmSync(testUserDataDir, { recursive: true, force: true })

    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('calculates dashboard stats from macros and counters', async () => {
    const { macroRepository } = await import('./macro.repository')
    const { statsService } = await import('./stats.service')

    const first = macroRepository.save({
      name: 'A',
      shortcut: 'CTRL+A',
      blocksJson: { nodes: [], zoom: 1 }
    })
    macroRepository.save({
      name: 'B',
      shortcut: 'CTRL+B',
      blocksJson: { nodes: [], zoom: 1 }
    })
    macroRepository.toggleActive(first.id, true)

    statsService.recordRun({ success: true, timeSavedMinutes: 5 })
    statsService.recordRun({ success: false, timeSavedMinutes: 0 })

    const stats = statsService.getDashboardStats()
    expect(stats.totalAutomations).toBe(2)
    expect(stats.activeNow).toBe(1)
    expect(stats.successRate).toBe(50)
    expect(stats.timeSavedMinutes).toBe(5)
  })
})
