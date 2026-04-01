import type { EditorNode } from '../../../../shared/api'

const TOP_NOTCH_DEPTH = 11
const BOTTOM_TAB_HEIGHT = 12
const SNAP_THRESHOLD_X = 84
const SNAP_THRESHOLD_Y = 32

const BODY_HEIGHT_BY_TYPE: Record<EditorNode['type'], number> = {
  START: 68,
  PRESS_KEY: 102,
  WAIT: 102,
  MOUSE_CLICK: 102,
  TYPE_TEXT: 102,
  REPEAT: 102
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
  excludeIds: Set<string>
): SnapCandidate | null => {
  const draggedNode = getNodeById(nodes, nodeId)
  if (!draggedNode) return null
  if (draggedNode.type === 'START') return null

  let bestCandidate: SnapCandidate | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of nodes) {
    if (candidate.id === nodeId) continue
    if (excludeIds.has(candidate.id)) continue
    if (canCreateLoop(nodes, candidate.id, nodeId)) continue

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
