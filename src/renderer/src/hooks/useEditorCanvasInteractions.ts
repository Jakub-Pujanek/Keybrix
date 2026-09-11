import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorNode } from '../../../shared/api'
import { clampNodeToWorld, getEdgePanDelta } from '../lib/editor/canvasCamera'
import {
  buildSnapSpatialIndex,
  canCreateLoop,
  getBlockTotalHeight,
  getChainFrom,
  getNodeById,
  getSnapCandidate,
  mapChainPositions,
  resolveNodePositions,
  type SnapSpatialIndex
} from '../lib/editor/canvasPhysics'

type DragSession = {
  rootId: string
  chainIds: string[]
  excludeIds: Set<string>
  loopCache: Map<string, boolean>
  initialPositions: Map<string, { x: number; y: number }>
  pointerStartX: number
  pointerStartY: number
  lastClientX: number
  lastClientY: number
  // World-space shift accumulated from edge-panning mid-drag — added to the
  // pointer delta so the dragged chain stays glued to the cursor while the
  // camera scrolls the world underneath it.
  panOffsetX: number
  panOffsetY: number
  moved: boolean
}

type UseEditorCanvasInteractionsInput = {
  nodes: EditorNode[]
  nodeHeights: Record<string, number>
  zoom: number
  canvasRef: React.RefObject<HTMLDivElement | null>
  panCameraBy: (dx: number, dy: number) => { x: number; y: number }
  setManyNodePositions: (updates: Array<{ id: string; x: number; y: number }>) => void
  setNodeNext: (nodeId: string, nextId: string | null) => void
  clearIncomingConnection: (nodeId: string) => void
  removeNodeTree: (rootId: string) => void
  isDeleteZoneHit: (clientX: number, clientY: number) => boolean
}

export type UseEditorCanvasInteractionsOutput = {
  snapPreviewParentId: string | null
  snapPreviewChildId: string | null
  displayPositions: Record<string, { x: number; y: number }>
  isDraggingBlocks: boolean
  selectedNodeIds: string[]
  deleteSelected: () => void
  handleBlockPointerDown: (nodeId: string, clientX: number, clientY: number) => void
}

const toObjectPositions = (
  updates: Array<{ id: string; x: number; y: number }>
): Record<string, { x: number; y: number }> => {
  const out: Record<string, { x: number; y: number }> = {}

  for (const item of updates) {
    out[item.id] = {
      x: item.x,
      y: item.y
    }
  }

  return out
}

export function useEditorCanvasInteractions({
  nodes,
  nodeHeights,
  zoom,
  canvasRef,
  panCameraBy,
  setManyNodePositions,
  setNodeNext,
  clearIncomingConnection,
  removeNodeTree,
  isDeleteZoneHit
}: UseEditorCanvasInteractionsInput): UseEditorCanvasInteractionsOutput {
  const [snapPreviewParentId, setSnapPreviewParentId] = useState<string | null>(null)
  const [snapPreviewChildId, setSnapPreviewChildId] = useState<string | null>(null)
  const [displayPositions, setDisplayPositions] = useState<
    Record<string, { x: number; y: number }>
  >({})
  const [isDraggingBlocks, setIsDraggingBlocks] = useState(false)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])

  const sessionRef = useRef<DragSession | null>(null)
  const nodesRef = useRef(nodes)
  const nodeHeightsRef = useRef(nodeHeights)
  const zoomRef = useRef(zoom)
  const spatialIndexRef = useRef<SnapSpatialIndex | null>(null)
  const moveHandlerRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const upHandlerRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const panCameraByRef = useRef(panCameraBy)
  const frameRef = useRef<number | null>(null)
  const pendingDisplayPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const previewRef = useRef<{ childId: string | null; parentId: string | null }>({
    childId: null,
    parentId: null
  })

  useEffect(() => {
    nodesRef.current = nodes
    nodeHeightsRef.current = nodeHeights
    spatialIndexRef.current = buildSnapSpatialIndex(nodes, nodeHeights)
  }, [nodes, nodeHeights])

  useEffect(() => {
    zoomRef.current = zoom
    panCameraByRef.current = panCameraBy
  }, [zoom, panCameraBy])

  const clearPreview = useCallback((): void => {
    previewRef.current = { childId: null, parentId: null }
    setSnapPreviewChildId(null)
    setSnapPreviewParentId(null)
  }, [])

  const applyPreview = useCallback((childId: string | null, parentId: string | null): void => {
    const prev = previewRef.current
    if (prev.childId === childId && prev.parentId === parentId) return

    previewRef.current = { childId, parentId }
    setSnapPreviewChildId(childId)
    setSnapPreviewParentId(parentId)
  }, [])

  const clearDragPreviewState = useCallback((): void => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    pendingDisplayPositionsRef.current = {}
    setDisplayPositions({})
  }, [])

  // Shared by pointermove and the edge-pan ticker: recomputes the dragged
  // chain's raw position, snap preview and pending display positions for a
  // world-space pointer delta.
  const updateDragPositions = useCallback(
    (session: DragSession, dx: number, dy: number): void => {
      const rootInitial = session.initialPositions.get(session.rootId)
      if (!rootInitial) return

      const rawX = rootInitial.x + dx
      const rawY = rootInitial.y + dy

      const candidate = getSnapCandidate({
        nodes: nodesRef.current,
        nodeId: session.rootId,
        rawX,
        rawY,
        excludeIds: session.excludeIds,
        spatialIndex: spatialIndexRef.current ?? undefined,
        loopCache: session.loopCache,
        heights: nodeHeightsRef.current,
        zoom: zoomRef.current
      })

      applyPreview(candidate ? session.rootId : null, candidate ? candidate.parentId : null)

      const updates = mapChainPositions(session.chainIds, session.initialPositions, dx, dy)
      pendingDisplayPositionsRef.current = toObjectPositions(updates)

      if (frameRef.current !== null) return

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null

        if (!sessionRef.current) return

        setDisplayPositions(pendingDisplayPositionsRef.current)
      })
    },
    [applyPreview]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent): void => {
      const session = sessionRef.current
      if (!session) return

      event.preventDefault()
      session.lastClientX = event.clientX
      session.lastClientY = event.clientY

      const dx = (event.clientX - session.pointerStartX) / zoomRef.current + session.panOffsetX
      const dy = (event.clientY - session.pointerStartY) / zoomRef.current + session.panOffsetY

      if (!session.moved && Math.hypot(dx, dy) > 2) {
        session.moved = true
      }

      updateDragPositions(session, dx, dy)
    },
    [updateDragPositions]
  )

  const finalizeDrag = useCallback(
    (clientX: number, clientY: number): void => {
      const session = sessionRef.current
      if (!session) return

      if (!session.moved) {
        setSelectedNodeIds(session.chainIds)
        sessionRef.current = null
        clearDragPreviewState()
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      if (isDeleteZoneHit(clientX, clientY)) {
        removeNodeTree(session.rootId)
        setSelectedNodeIds([])
        sessionRef.current = null
        clearDragPreviewState()
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      const dx = (clientX - session.pointerStartX) / zoomRef.current + session.panOffsetX
      const dy = (clientY - session.pointerStartY) / zoomRef.current + session.panOffsetY

      const rootInitial = session.initialPositions.get(session.rootId)
      if (!rootInitial) {
        sessionRef.current = null
        clearDragPreviewState()
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      const rawX = rootInitial.x + dx
      const rawY = rootInitial.y + dy

      const candidate = getSnapCandidate({
        nodes: nodesRef.current,
        nodeId: session.rootId,
        rawX,
        rawY,
        excludeIds: session.excludeIds,
        spatialIndex: spatialIndexRef.current ?? undefined,
        loopCache: session.loopCache,
        heights: nodeHeightsRef.current,
        zoom: zoomRef.current
      })

      // A block dropped beyond the world bounds would render off-canvas and be
      // unreachable — the camera can never pan there — so clamp every chain
      // position into the world rect.
      const clampUpdates = (
        updates: Array<{ id: string; x: number; y: number }>
      ): Array<{ id: string; x: number; y: number }> =>
        updates.map((update) => {
          const node = getNodeById(nodesRef.current, update.id)
          if (!node) return update

          const clamped = clampNodeToWorld(
            update.x,
            update.y,
            getBlockTotalHeight(node, nodeHeightsRef.current)
          )
          return { id: update.id, x: clamped.x, y: clamped.y }
        })

      if (candidate) {
        const adjustX = candidate.snapX - rawX
        const adjustY = candidate.snapY - rawY

        const updates = mapChainPositions(
          session.chainIds,
          session.initialPositions,
          dx,
          dy,
          adjustX,
          adjustY
        )

        if (updates.length > 0) {
          setManyNodePositions(clampUpdates(updates))
        }

        const displacedId = getNodeById(nodesRef.current, candidate.parentId)?.nextId ?? null
        const tailId = session.chainIds[session.chainIds.length - 1]

        clearIncomingConnection(session.rootId)
        setNodeNext(candidate.parentId, session.rootId)

        // Scratch-style splice: the slot's previous child subtree is re-attached
        // under the tail of the inserted chain instead of being orphaned.
        if (
          displacedId &&
          tailId &&
          !session.excludeIds.has(displacedId) &&
          !canCreateLoop(nodesRef.current, tailId, displacedId)
        ) {
          setNodeNext(tailId, displacedId)
        }
      } else {
        const updates = mapChainPositions(session.chainIds, session.initialPositions, dx, dy)

        if (updates.length > 0) {
          setManyNodePositions(clampUpdates(updates))
        }

        clearIncomingConnection(session.rootId)
      }

      sessionRef.current = null
      clearDragPreviewState()
      setIsDraggingBlocks(false)
      clearPreview()
    },
    [
      clearIncomingConnection,
      clearPreview,
      isDeleteZoneHit,
      removeNodeTree,
      setManyNodePositions,
      setNodeNext,
      clearDragPreviewState
    ]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent): void => {
      finalizeDrag(event.clientX, event.clientY)
    },
    [finalizeDrag]
  )

  useEffect(() => {
    moveHandlerRef.current = handlePointerMove
    upHandlerRef.current = handlePointerUp
  }, [handlePointerMove, handlePointerUp])

  // Edge-pan: while dragging, a pointer held near the viewport edge scrolls
  // the camera on a ~60fps interval. The real applied camera delta is
  // accumulated into session.panOffset so the chain stays glued to the
  // (stationary) pointer. setInterval instead of rAF keeps it test-friendly.
  useEffect(() => {
    if (!isDraggingBlocks) return

    const interval = window.setInterval(() => {
      const session = sessionRef.current
      const viewport = canvasRef.current
      if (!session || !viewport) return

      const delta = getEdgePanDelta(
        session.lastClientX,
        session.lastClientY,
        viewport.getBoundingClientRect()
      )
      if (delta.x === 0 && delta.y === 0) return

      const applied = panCameraByRef.current(delta.x, delta.y)
      session.panOffsetX += applied.x / zoomRef.current
      session.panOffsetY += applied.y / zoomRef.current

      const dx =
        (session.lastClientX - session.pointerStartX) / zoomRef.current + session.panOffsetX
      const dy =
        (session.lastClientY - session.pointerStartY) / zoomRef.current + session.panOffsetY
      updateDragPositions(session, dx, dy)
    }, 16)

    return () => window.clearInterval(interval)
  }, [isDraggingBlocks, canvasRef, updateDragPositions])

  useEffect(() => {
    if (!isDraggingBlocks) return

    const onMove = (event: PointerEvent): void => {
      moveHandlerRef.current(event)
    }

    const onUp = (event: PointerEvent): void => {
      upHandlerRef.current(event)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isDraggingBlocks])

  const handleBlockPointerDown = (nodeId: string, clientX: number, clientY: number): void => {
    clearDragPreviewState()

    const chainIds = getChainFrom(nodesRef.current, nodeId)
    const positions =
      spatialIndexRef.current?.positions ??
      resolveNodePositions(nodesRef.current, nodeHeightsRef.current)
    const initialPositions = new Map<string, { x: number; y: number }>()

    for (const id of chainIds) {
      const position = positions.get(id)
      if (!position) continue

      initialPositions.set(id, position)
    }

    sessionRef.current = {
      rootId: nodeId,
      chainIds,
      excludeIds: new Set(chainIds),
      loopCache: new Map<string, boolean>(),
      initialPositions,
      pointerStartX: clientX,
      pointerStartY: clientY,
      lastClientX: clientX,
      lastClientY: clientY,
      panOffsetX: 0,
      panOffsetY: 0,
      moved: false
    }

    setIsDraggingBlocks(true)
    clearPreview()
  }

  const deleteSelected = useCallback((): void => {
    if (selectedNodeIds.length === 0) return

    removeNodeTree(selectedNodeIds[0])
    setSelectedNodeIds([])
  }, [removeNodeTree, selectedNodeIds])

  useEffect(() => {
    return () => {
      clearDragPreviewState()
    }
  }, [clearDragPreviewState])

  return {
    snapPreviewParentId,
    snapPreviewChildId,
    displayPositions,
    isDraggingBlocks,
    selectedNodeIds,
    deleteSelected,
    handleBlockPointerDown
  }
}
