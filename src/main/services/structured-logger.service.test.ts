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

describe('StructuredLoggerService', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('writes contextual log entry to logs buffer', async () => {
    const { structuredLogger } = await import('./structured-logger.service')
    const { logsService } = await import('./logs.service')

    structuredLogger.info('Macro blocked', {
      scope: 'macro.run',
      macroId: 'm-1',
      reason: 'global-master-off'
    })

    const recent = logsService.getRecent(1)
    expect(recent[0]?.level).toBe('INFO')
    expect(recent[0]?.message).toContain('Macro blocked')
    expect(recent[0]?.message).toContain('macro.run')
    expect(recent[0]?.message).toContain('global-master-off')
  })

  it('persists audit event in newest-first order', async () => {
    const { structuredLogger } = await import('./structured-logger.service')
    const { mainStore } = await import('../store')

    structuredLogger.audit({
      action: 'SETTINGS_UPDATED',
      correlationId: 'corr-1',
      meta: { keys: ['globalMaster'] }
    })

    structuredLogger.audit({
      action: 'MACRO_RUN',
      targetId: 'macro-1',
      correlationId: 'corr-2'
    })

    const auditBuffer = mainStore.getState().audit.buffer
    expect(auditBuffer).toHaveLength(2)
    expect(auditBuffer[0]?.action).toBe('MACRO_RUN')
    expect(auditBuffer[1]?.action).toBe('SETTINGS_UPDATED')
  })
})
