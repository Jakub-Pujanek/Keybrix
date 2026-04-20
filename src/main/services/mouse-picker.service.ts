import { screen } from 'electron'
import type { MousePickerPoint, MousePickerPreview } from '../../shared/api'

type CursorPointProvider = () => { x: number; y: number }

type MousePickerServiceDeps = {
  getCursorPoint?: CursorPointProvider
  nowIso?: () => string
  pollIntervalMs?: number
}

type MousePickerPreviewListener = (payload: MousePickerPreview) => void
type MousePickerCoordinateListener = (payload: MousePickerPoint) => void

export class MousePickerService {
  private readonly previewListeners = new Set<MousePickerPreviewListener>()
  private readonly coordinateListeners = new Set<MousePickerCoordinateListener>()
  private readonly getCursorPoint: CursorPointProvider
  private readonly nowIso: () => string
  private readonly pollIntervalMs: number

  private active = false
  private timer: ReturnType<typeof setInterval> | null = null
  private lastPoint: MousePickerPoint | null = null

  constructor(deps: MousePickerServiceDeps = {}) {
    this.getCursorPoint = deps.getCursorPoint ?? (() => screen.getCursorScreenPoint())
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString())
    this.pollIntervalMs = deps.pollIntervalMs ?? 100
  }

  start(): boolean {
    if (this.active) {
      return false
    }

    this.active = true
    this.emitPreviewFromCursor()
    this.timer = setInterval(() => {
      this.emitPreviewFromCursor()
    }, this.pollIntervalMs)

    return true
  }

  stop(): boolean {
    if (!this.active) {
      return false
    }

    this.active = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const selectedPoint = this.lastPoint ?? this.readPointFromCursor()
    if (selectedPoint) {
      this.lastPoint = selectedPoint
      for (const listener of this.coordinateListeners) {
        listener(selectedPoint)
      }
    }

    return true
  }

  dispose(): void {
    this.active = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  onPreviewUpdate(listener: MousePickerPreviewListener): () => void {
    this.previewListeners.add(listener)
    return () => {
      this.previewListeners.delete(listener)
    }
  }

  onCoordinateSelected(listener: MousePickerCoordinateListener): () => void {
    this.coordinateListeners.add(listener)
    return () => {
      this.coordinateListeners.delete(listener)
    }
  }

  private emitPreviewFromCursor(): void {
    const point = this.readPointFromCursor()
    if (!point) {
      return
    }

    this.lastPoint = point
    const payload: MousePickerPreview = {
      ...point,
      isActive: this.active
    }

    for (const listener of this.previewListeners) {
      listener(payload)
    }
  }

  private readPointFromCursor(): MousePickerPoint | null {
    try {
      const point = this.getCursorPoint()
      return {
        x: Math.max(0, Math.round(point.x)),
        y: Math.max(0, Math.round(point.y)),
        timestamp: this.nowIso()
      }
    } catch {
      return null
    }
  }
}

export const mousePickerService = new MousePickerService()
