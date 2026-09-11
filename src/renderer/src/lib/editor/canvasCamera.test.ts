import { describe, expect, it } from 'vitest'
import {
  centerCameraOnWorld,
  clampCameraToViewport,
  clampNodeToWorld,
  clampZoom,
  getEdgePanDelta,
  zoomAnchoredCamera,
  WORLD_CENTER_X,
  WORLD_CENTER_Y,
  WORLD_HEIGHT
} from './canvasCamera'

const VIEWPORT = { width: 1000, height: 800 }

describe('clampZoom', () => {
  it('clamps into [0.5, 2]', () => {
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(10)).toBe(2)
  })
})

describe('clampCameraToViewport', () => {
  it('clamps into [0, world*zoom - viewport] when the world is larger', () => {
    const clamped = clampCameraToViewport({ x: -100, y: 99999 }, 1, VIEWPORT)
    expect(clamped).toEqual({ x: 0, y: WORLD_HEIGHT - VIEWPORT.height })
  })

  it('centers the world when it is smaller than the viewport', () => {
    // world 6000x4000 at zoom 0.1 → 600x400 < 1000x800 viewport.
    const clamped = clampCameraToViewport({ x: 0, y: 0 }, 0.1, VIEWPORT)
    expect(clamped).toEqual({ x: (600 - 1000) / 2, y: (400 - 800) / 2 })
  })
})

describe('centerCameraOnWorld', () => {
  it('puts the world center at the viewport center', () => {
    const camera = centerCameraOnWorld(1, VIEWPORT)
    // world point at camera-offset center: (viewport/2 + camera) / zoom
    expect((VIEWPORT.width / 2 + camera.x) / 1).toBeCloseTo(WORLD_CENTER_X)
    expect((VIEWPORT.height / 2 + camera.y) / 1).toBeCloseTo(WORLD_CENTER_Y)
  })
})

describe('zoomAnchoredCamera', () => {
  it('keeps the anchored screen point on the same world point', () => {
    const camera = { x: 500, y: 400 }
    const anchor = { x: 300, y: 250 }

    const next = zoomAnchoredCamera(camera, 1, 1.5, anchor, VIEWPORT)

    const worldX = (anchor.x + camera.x) / 1
    const worldY = (anchor.y + camera.y) / 1
    expect((anchor.x + next.x) / 1.5).toBeCloseTo(worldX)
    expect((anchor.y + next.y) / 1.5).toBeCloseTo(worldY)
  })

  it('clamps the result to the world bounds', () => {
    const next = zoomAnchoredCamera({ x: 0, y: 0 }, 1, 0.5, { x: 0, y: 0 }, VIEWPORT)
    expect(next.x).toBeGreaterThanOrEqual(0)
    expect(next.y).toBeGreaterThanOrEqual(0)
  })
})

describe('clampNodeToWorld', () => {
  it('keeps positions inside the centered world rect', () => {
    expect(clampNodeToWorld(-99999, 99999, 114, 430)).toEqual({
      x: -WORLD_CENTER_X,
      y: WORLD_CENTER_Y - 114
    })
    expect(clampNodeToWorld(0, 0, 114, 430)).toEqual({ x: 0, y: 0 })
    expect(clampNodeToWorld(99999, -99999, 114, 430)).toEqual({
      x: WORLD_CENTER_X - 430,
      y: -WORLD_CENTER_Y
    })
  })
})

describe('getEdgePanDelta', () => {
  const rect = { left: 0, top: 0, right: 1000, bottom: 800 }

  it('returns zero inside the safe zone', () => {
    expect(getEdgePanDelta(500, 400, rect)).toEqual({ x: 0, y: 0 })
  })

  it('pans right near the right edge, scaled by proximity', () => {
    const delta = getEdgePanDelta(990, 400, rect)
    expect(delta.x).toBeGreaterThan(0)
    expect(delta.x).toBeLessThanOrEqual(16)
    expect(delta.y).toBe(0)
  })

  it('pans left at full speed when beyond the left edge', () => {
    const delta = getEdgePanDelta(-50, 400, rect)
    expect(delta.x).toBe(-16)
  })

  it('pans on both axes near a corner', () => {
    const delta = getEdgePanDelta(10, 790, rect)
    expect(delta.x).toBeLessThan(0)
    expect(delta.y).toBeGreaterThan(0)
  })
})
