import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MousePickerService } from './mouse-picker.service'

describe('MousePickerService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits preview updates while active and coordinate on stop', () => {
    const points = [
      { x: 10, y: 20 },
      { x: 11, y: 21 },
      { x: 12, y: 22 }
    ]
    const getCursorPoint = vi.fn(() => points.shift() ?? { x: 12, y: 22 })
    const service = new MousePickerService({
      getCursorPoint,
      nowIso: () => '2026-04-19T00:00:00.000Z',
      pollIntervalMs: 50
    })

    const previews: Array<{ x: number; y: number; isActive: boolean }> = []
    const selected: Array<{ x: number; y: number }> = []

    service.onPreviewUpdate((payload) => {
      previews.push(payload)
    })
    service.onCoordinateSelected((payload) => {
      selected.push(payload)
    })

    expect(service.start()).toBe(true)
    vi.advanceTimersByTime(120)
    expect(service.stop()).toBe(true)

    expect(previews.length).toBeGreaterThanOrEqual(2)
    expect(previews.at(0)?.isActive).toBe(true)
    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({ x: 12, y: 22 })
  })

  it('uses fresh cursor read if no preview point was captured before stop', () => {
    let callIndex = 0
    const getCursorPoint = vi.fn(() => {
      callIndex += 1
      if (callIndex === 1) {
        throw new Error('cursor read failed on initial preview')
      }

      return { x: 99, y: 101 }
    })
    const service = new MousePickerService({
      getCursorPoint,
      nowIso: () => '2026-04-19T00:00:00.000Z',
      pollIntervalMs: 1000
    })

    const selected: Array<{ x: number; y: number }> = []
    service.onCoordinateSelected((payload) => {
      selected.push(payload)
    })

    expect(service.start()).toBe(true)

    expect(service.stop()).toBe(true)
    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({ x: 99, y: 101 })
  })
})
