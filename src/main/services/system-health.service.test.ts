import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { systemHealthService } from './system-health.service'

describe('SystemHealthService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    systemHealthService.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('emits DEGRADED after two consecutive degraded samples', () => {
    const statuses: Array<'OPTIMAL' | 'DEGRADED'> = []
    const off = systemHealthService.onStatusChange((status) => {
      statuses.push(status)
    })

    vi.spyOn(process, 'memoryUsage').mockImplementation(
      () =>
        ({
          rss: 2 * 1024 * 1024 * 1024,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0
        }) as NodeJS.MemoryUsage
    )

    systemHealthService.start()
    vi.advanceTimersByTime(5000)
    vi.advanceTimersByTime(5000)

    off()

    expect(statuses).toContain('DEGRADED')
  })
})
