import type { EditorNode } from '../../../../shared/api'

const TOP_NOTCH_DEPTH = 11
const BOTTOM_TAB_HEIGHT = 12
const SNAP_THRESHOLD_X = 84
const SNAP_THRESHOLD_Y = 32
const SNAP_INDEX_CELL_SIZE = 220

const BODY_HEIGHT_BY_TYPE: Record<EditorNode['type'], number> = {
  START: 68,
  PRESS_KEY: 102,
  HOLD_KEY: 102,
  EXECUTE_SHORTCUT: 102,
  WAIT: 102,
  MOUSE_CLICK: 120,
  AUTOCLICKER_TIMED: 136,
  AUTOCLICKER_INFINITE: 102,
  MOVE_MOUSE_DURATION: 152,
  TYPE_TEXT: 102,
  REPEAT: 102,
  INFINITE_LOOP: 102
}

export type SnapCandidate = {
  parentId: string
  snapX: number
  snapY: number
}

export type NodeHeightMap = Readonly<Record<string, number>>

export type ResolvedPositions = ReadonlyMap<string, { x: number; y: number }>

type ConnectionBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

export type SnapSpatialIndex = {
  cellSize: number
  buckets: Map<string, EditorNode[]>
  positions: Map<string, { x: number; y: number }>
}

// BODY_HEIGHT_BY_TYPE is only a pre-measurement fallback: the rendered block
// height is content-driven (i18n labels, wrapped rows), so the real value is
// measured from the DOM in CanvasGrid and passed here via NodeHeightMap.
export const getBlockTotalHeight = (node: EditorNode, heights?: NodeHeightMap): number => {
  return (heights?.[node.id] ?? BODY_HEIGHT_BY_TYPE[node.type]) + BOTTOM_TAB_HEIGHT
}

export const getConnectedChildY = (
  parentNode: EditorNode,
  heights?: NodeHeightMap,
  positions?: ResolvedPositions
): number => {
  const baseY = positions?.get(parentNode.id)?.y ?? parentNode.y
  return baseY + getBlockTotalHeight(parentNode, heights) - TOP_NOTCH_DEPTH
}

// Connected children derive their position from the parent chain — the stored
// x/y is only authoritative for chain roots (nodes without an incoming link).
export const resolveNodePositions = (
  nodes: EditorNode[],
  heights?: NodeHeightMap
): Map<string, { x: number; y: number }> => {
  const parentById = new Map<string, EditorNode>()
  for (const node of nodes) {
    if (node.nextId && !parentById.has(node.nextId)) {
      parentById.set(node.nextId, node)
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  const visiting = new Set<string>()

  const resolve = (node: EditorNode): { x: number; y: number } => {
    const cached = positions.get(node.id)
    if (cached) return cached

    const parent = parentById.get(node.id)
    let position = { x: node.x, y: node.y }
    if (parent && !visiting.has(node.id)) {
      visiting.add(node.id)
      const parentPosition = resolve(parent)
      position = {
        x: parentPosition.x,
        y: parentPosition.y + getBlockTotalHeight(parent, heights) - TOP_NOTCH_DEPTH
      }
      visiting.delete(node.id)
    }

    positions.set(node.id, position)
    return position
  }

  for (const node of nodes) {
    resolve(node)
  }

  return positions
}

const getConnectionBounds = (targetX: number, targetY: number): ConnectionBounds => {
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
  heights?: NodeHeightMap,
  cellSize = SNAP_INDEX_CELL_SIZE
): SnapSpatialIndex => {
  const buckets = new Map<string, EditorNode[]>()
  const positions = resolveNodePositions(nodes, heights)

  for (const node of nodes) {
    const position = positions.get(node.id) ?? { x: node.x, y: node.y }
    const key = getCellKey(position.x, getConnectedChildY(node, heights, positions), cellSize)
    const bucket = buckets.get(key)
    if (!bucket) {
      buckets.set(key, [node])
      continue
    }

    bucket.push(node)
  }

  return {
    cellSize,
    buckets,
    positions
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

export type SnapCandidateQuery = {
  nodes: EditorNode[]
  nodeId: string
  rawX: number
  rawY: number
  excludeIds: Set<string>
  spatialIndex?: SnapSpatialIndex
  loopCache?: Map<string, boolean>
  heights?: NodeHeightMap
}

export const getSnapCandidate = ({
  nodes,
  nodeId,
  rawX,
  rawY,
  excludeIds,
  spatialIndex,
  loopCache,
  heights
}: SnapCandidateQuery): SnapCandidate | null => {
  const draggedNode = getNodeById(nodes, nodeId)
  if (!draggedNode) return null
  if (draggedNode.type === 'START') return null

  const candidates = spatialIndex ? getSpatialCandidates(spatialIndex, rawX, rawY) : nodes
  const positions = spatialIndex?.positions ?? resolveNodePositions(nodes, heights)

  let bestCandidate: SnapCandidate | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate.id === nodeId) continue
    if (excludeIds.has(candidate.id)) continue

    const targetX = positions.get(candidate.id)?.x ?? candidate.x
    const targetY = getConnectedChildY(candidate, heights, positions)
    const bounds = getConnectionBounds(targetX, targetY)

    if (rawX < bounds.left || rawX > bounds.right || rawY < bounds.top || rawY > bounds.bottom) {
      continue
    }

    const loopKey = `${candidate.id}->${nodeId}`
    let loopBlocked = loopCache?.get(loopKey)
    if (loopBlocked === undefined) {
      loopBlocked = canCreateLoop(nodes, candidate.id, nodeId)
      loopCache?.set(loopKey, loopBlocked)
    }

    if (loopBlocked) continue

    const distance = Math.hypot(rawX - targetX, rawY - targetY)
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
