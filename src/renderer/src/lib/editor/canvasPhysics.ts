import type { EditorNode } from '../../../../shared/api'

const TOP_NOTCH_DEPTH = 11
const BOTTOM_TAB_HEIGHT = 12
const SNAP_THRESHOLD_X = 84
const SNAP_THRESHOLD_Y = 32
const SNAP_INDEX_CELL_SIZE = 220

const BODY_HEIGHT_BY_TYPE: Record<EditorNode['type'], number> = {
  START: 68,
  PRESS_KEY: 102,
  WAIT: 102,
  MOUSE_CLICK: 102,
  TYPE_TEXT: 102,
  REPEAT: 102,
  INFINITE_LOOP: 102
}

export type SnapCandidate = {
  parentId: string
  snapX: number
  snapY: number
}

type ConnectionBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

export type SnapSpatialIndex = {
  cellSize: number
  buckets: Map<string, EditorNode[]>
}

export const getBlockTotalHeight = (node: EditorNode): number => {
  return BODY_HEIGHT_BY_TYPE[node.type] + BOTTOM_TAB_HEIGHT
}

export const getConnectedChildY = (parentNode: EditorNode): number => {
  return parentNode.y + getBlockTotalHeight(parentNode) - TOP_NOTCH_DEPTH
}

const getConnectionBounds = (parentNode: EditorNode): ConnectionBounds => {
  const targetX = parentNode.x
  const targetY = getConnectedChildY(parentNode)

  return {
    left: targetX - SNAP_THRESHOLD_X,
    right: targetX + SNAP_THRESHOLD_X,
    top: targetY - SNAP_THRESHOLD_Y,
    bottom: targetY + SNAP_THRESHOLD_Y
  }
}

const getCellKey = (x: number, y: number, cellSize: number): string => {
  return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`
}

export const buildSnapSpatialIndex = (
  nodes: EditorNode[],
  cellSize = SNAP_INDEX_CELL_SIZE
): SnapSpatialIndex => {
  const buckets = new Map<string, EditorNode[]>()

  for (const node of nodes) {
    const key = getCellKey(node.x, getConnectedChildY(node), cellSize)
    const bucket = buckets.get(key)
    if (!bucket) {
      buckets.set(key, [node])
      continue
    }

    bucket.push(node)
  }

  return {
    cellSize,
    buckets
  }
}

const getSpatialCandidates = (
  index: SnapSpatialIndex,
  rawX: number,
  rawY: number
): EditorNode[] => {
  const rangeX = Math.ceil(SNAP_THRESHOLD_X / index.cellSize)
  const rangeY = Math.ceil(SNAP_THRESHOLD_Y / index.cellSize)
  const centerCellX = Math.floor(rawX / index.cellSize)
  const centerCellY = Math.floor(rawY / index.cellSize)

  const seen = new Set<string>()
  const out: EditorNode[] = []

  for (let x = centerCellX - rangeX; x <= centerCellX + rangeX; x += 1) {
    for (let y = centerCellY - rangeY; y <= centerCellY + rangeY; y += 1) {
      const bucket = index.buckets.get(`${x}:${y}`)
      if (!bucket) continue

      for (const node of bucket) {
        if (seen.has(node.id)) continue
        seen.add(node.id)
        out.push(node)
      }
    }
  }

  return out
}

export const getNodeById = (nodes: EditorNode[], id: string): EditorNode | undefined =>
  nodes.find((node) => node.id === id)

export const getChainFrom = (nodes: EditorNode[], nodeId: string): string[] => {
  const chain: string[] = []
  const seen = new Set<string>()

  let cursor = getNodeById(nodes, nodeId)
  while (cursor && !seen.has(cursor.id)) {
    chain.push(cursor.id)
    seen.add(cursor.id)
    cursor = cursor.nextId ? getNodeById(nodes, cursor.nextId) : undefined
  }

  return chain
}

export const canCreateLoop = (nodes: EditorNode[], parentId: string, childId: string): boolean => {
  let cursor = getNodeById(nodes, childId)
  const visited = new Set<string>()

  while (cursor?.nextId && !visited.has(cursor.id)) {
    if (cursor.nextId === parentId) return true
    visited.add(cursor.id)
    cursor = getNodeById(nodes, cursor.nextId)
  }

  return false
}

export const getSnapCandidate = (
  nodes: EditorNode[],
  nodeId: string,
  rawX: number,
  rawY: number,
  excludeIds: Set<string>,
  spatialIndex?: SnapSpatialIndex,
  loopCache?: Map<string, boolean>
): SnapCandidate | null => {
  const draggedNode = getNodeById(nodes, nodeId)
  if (!draggedNode) return null
  if (draggedNode.type === 'START') return null

  const candidates = spatialIndex ? getSpatialCandidates(spatialIndex, rawX, rawY) : nodes

  let bestCandidate: SnapCandidate | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate.id === nodeId) continue
    if (excludeIds.has(candidate.id)) continue

    const loopKey = `${candidate.id}->${nodeId}`
    const loopBlocked = loopCache?.has(loopKey)
      ? loopCache.get(loopKey) === true
      : canCreateLoop(nodes, candidate.id, nodeId)

    if (!loopCache?.has(loopKey)) {
      loopCache?.set(loopKey, loopBlocked)
    }

    if (loopBlocked) continue

    const targetX = candidate.x
    const targetY = getConnectedChildY(candidate)
    const dx = rawX - targetX
    const dy = rawY - targetY
    const bounds = getConnectionBounds(candidate)

    if (rawX < bounds.left || rawX > bounds.right || rawY < bounds.top || rawY > bounds.bottom) {
      continue
    }

    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      bestCandidate = {
        parentId: candidate.id,
        snapX: targetX,
        snapY: targetY
      }
    }
  }

  return bestCandidate
}

export const mapChainPositions = (
  chainIds: string[],
  initialPositions: Map<string, { x: number; y: number }>,
  dx: number,
  dy: number,
  adjustX = 0,
  adjustY = 0
): Array<{ id: string; x: number; y: number }> => {
  return chainIds
    .map((id) => {
      const initial = initialPositions.get(id)
      if (!initial) return null

      return {
        id,
        x: initial.x + dx + adjustX,
        y: initial.y + dy + adjustY
      }
    })
    .filter((item): item is { id: string; x: number; y: number } => item !== null)
}
