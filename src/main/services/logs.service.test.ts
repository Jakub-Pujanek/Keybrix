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

describe('LogsService', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('appends log and returns newest-first list', async () => {
    const { logsService } = await import('./logs.service')

    const first = logsService.append({ level: 'INFO', message: 'first' })
    const second = logsService.append({ level: 'WARN', message: 'second' })

    const recent = logsService.getRecent()
    expect(recent[0]?.id).toBe(second.id)
    expect(recent[1]?.id).toBe(first.id)
  })

  it('retains up to 200 logs', async () => {
    const { logsService } = await import('./logs.service')

    for (let i = 0; i < 250; i += 1) {
      logsService.append({ level: 'INFO', message: `log-${i}` })
    }

    const recent = logsService.getRecent(500)
    expect(recent).toHaveLength(200)
  })
})
