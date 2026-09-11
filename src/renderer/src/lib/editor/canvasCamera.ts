export const WORLD_WIDTH = 6000
export const WORLD_HEIGHT = 4000
export const WORLD_CENTER_X = WORLD_WIDTH / 2
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 2

// ActionBlock renders at w-107.5 (27.5rem).
export const NODE_BLOCK_WIDTH = 430

export type CameraPosition = { x: number; y: number }
export type ViewportSize = { width: number; height: number }

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

// A world smaller than the viewport is centered (negative camera) instead of
// being pinned to the top-left corner.
export const clampCameraToViewport = (
  camera: CameraPosition,
  zoom: number,
  viewport: ViewportSize
): CameraPosition => {
  const clampAxis = (value: number, span: number, visible: number): number => {
    if (span <= visible) return (span - visible) / 2
    return Math.min(Math.max(0, value), span - visible)
  }

  return {
    x: clampAxis(camera.x, WORLD_WIDTH * zoom, viewport.width),
    y: clampAxis(camera.y, WORLD_HEIGHT * zoom, viewport.height)
  }
}

export const centerCameraOnWorld = (zoom: number, viewport: ViewportSize): CameraPosition =>
  clampCameraToViewport(
    {
      x: WORLD_CENTER_X * zoom - viewport.width / 2,
      y: WORLD_CENTER_Y * zoom - viewport.height / 2
    },
    zoom,
    viewport
  )

// Keeps the world point under anchorScreen fixed while the zoom changes —
// the anchor stays glued to the same spot on screen.
export const zoomAnchoredCamera = (
  camera: CameraPosition,
  zoom: number,
  nextZoom: number,
  anchorScreen: CameraPosition,
  viewport: ViewportSize
): CameraPosition => {
  const worldX = (anchorScreen.x + camera.x) / zoom
  const worldY = (anchorScreen.y + camera.y) / zoom

  return clampCameraToViewport(
    {
      x: worldX * nextZoom - anchorScreen.x,
      y: worldY * nextZoom - anchorScreen.y
    },
    nextZoom,
    viewport
  )
}

// Node coordinates are centered on the world origin (a node at x=0 renders at
// the world's horizontal center). Drop positions are clamped so a block can
// never end up unreachable beyond the pannable world bounds.
export const clampNodeToWorld = (
  x: number,
  y: number,
  nodeHeight: number,
  nodeWidth = NODE_BLOCK_WIDTH
): CameraPosition => ({
  x: Math.min(Math.max(x, -WORLD_CENTER_X), WORLD_CENTER_X - nodeWidth),
  y: Math.min(Math.max(y, -WORLD_CENTER_Y), WORLD_CENTER_Y - nodeHeight)
})

export const EDGE_PAN_MARGIN_PX = 48
export const EDGE_PAN_MAX_SPEED_PX = 16

// Screen-px camera delta for one animation frame while the pointer is held
// near a viewport edge. Positive x pans the view rightward (revealing more of
// the world's right side).
export const getEdgePanDelta = (
  clientX: number,
  clientY: number,
  viewportRect: { left: number; top: number; right: number; bottom: number },
  margin = EDGE_PAN_MARGIN_PX,
  maxSpeed = EDGE_PAN_MAX_SPEED_PX
): CameraPosition => {
  const axis = (position: number, start: number, end: number): number => {
    if (position < start + margin) {
      return -maxSpeed * Math.min(1, Math.max(0, 1 - (position - start) / margin))
    }
    if (position > end - margin) {
      return maxSpeed * Math.min(1, Math.max(0, 1 - (end - position) / margin))
    }
    return 0
  }

  return {
    x: axis(clientX, viewportRect.left, viewportRect.right),
    y: axis(clientY, viewportRect.top, viewportRect.bottom)
  }
}
