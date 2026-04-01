import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorNode } from '../../../shared/api'
import {
  getChainFrom,
  getNodeById,
  getSnapCandidate,
  mapChainPositions
} from '../lib/editor/canvasPhysics'

type DragSession = {
  rootId: string
  chainIds: string[]
  initialPositions: Map<string, { x: number; y: number }>
  pointerStartX: number
  pointerStartY: number
  moved: boolean
}

type UseEditorCanvasInteractionsInput = {
  nodes: EditorNode[]
  zoom: number
  setManyNodePositions: (updates: Array<{ id: string; x: number; y: number }>) => void
  setNodeNext: (nodeId: string, nextId: string | null) => void
  clearIncomingConnection: (nodeId: string) => void
  removeNodeTree: (rootId: string) => void
  isDeleteZoneHit: (clientX: number, clientY: number) => boolean
}

type UseEditorCanvasInteractionsOutput = {
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
  zoom,
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
  const zoomRef = useRef(zoom)
  const moveHandlerRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const upHandlerRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const previewRef = useRef<{ childId: string | null; parentId: string | null }>({
    childId: null,
    parentId: null
  })

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

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

  const handlePointerMove = useCallback(
    (event: PointerEvent): void => {
      const session = sessionRef.current
      if (!session) return

      event.preventDefault()

      const dx = (event.clientX - session.pointerStartX) / zoomRef.current
      const dy = (event.clientY - session.pointerStartY) / zoomRef.current

      if (!session.moved && Math.hypot(dx, dy) > 2) {
        session.moved = true
      }

      const rootInitial = session.initialPositions.get(session.rootId)
      if (!rootInitial) return

      const rawX = rootInitial.x + dx
      const rawY = rootInitial.y + dy

      const candidate = getSnapCandidate(
        nodesRef.current,
        session.rootId,
        rawX,
        rawY,
        new Set(session.chainIds)
      )

      applyPreview(candidate ? session.rootId : null, candidate ? candidate.parentId : null)

      const updates = mapChainPositions(session.chainIds, session.initialPositions, dx, dy)
      setDisplayPositions(toObjectPositions(updates))
    },
    [applyPreview]
  )

  const finalizeDrag = useCallback(
    (clientX: number, clientY: number): void => {
      const session = sessionRef.current
      if (!session) return

      if (!session.moved) {
        setSelectedNodeIds(session.chainIds)
        sessionRef.current = null
        setDisplayPositions({})
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      if (isDeleteZoneHit(clientX, clientY)) {
        removeNodeTree(session.rootId)
        setSelectedNodeIds([])
        sessionRef.current = null
        setDisplayPositions({})
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      const dx = (clientX - session.pointerStartX) / zoomRef.current
      const dy = (clientY - session.pointerStartY) / zoomRef.current

      const rootInitial = session.initialPositions.get(session.rootId)
      if (!rootInitial) {
        sessionRef.current = null
        setDisplayPositions({})
        setIsDraggingBlocks(false)
        clearPreview()
        return
      }

      const rawX = rootInitial.x + dx
      const rawY = rootInitial.y + dy

      const candidate = getSnapCandidate(
        nodesRef.current,
        session.rootId,
        rawX,
        rawY,
        new Set(session.chainIds)
      )

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
          setManyNodePositions(updates)
        }

        clearIncomingConnection(session.rootId)
        setNodeNext(candidate.parentId, session.rootId)
      } else {
        const updates = mapChainPositions(session.chainIds, session.initialPositions, dx, dy)

        if (updates.length > 0) {
          setManyNodePositions(updates)
        }

        clearIncomingConnection(session.rootId)
      }

      sessionRef.current = null
      setDisplayPositions({})
      setIsDraggingBlocks(false)
      clearPreview()
    },
    [
      clearIncomingConnection,
      clearPreview,
      isDeleteZoneHit,
      removeNodeTree,
      setManyNodePositions,
      setNodeNext
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
    const chainIds = getChainFrom(nodesRef.current, nodeId)
    const initialPositions = new Map<string, { x: number; y: number }>()

    for (const id of chainIds) {
      const node = getNodeById(nodesRef.current, id)
      if (!node) continue

      initialPositions.set(id, {
        x: node.x,
        y: node.y
      })
    }

    sessionRef.current = {
      rootId: nodeId,
      chainIds,
      initialPositions,
      pointerStartX: clientX,
      pointerStartY: clientY,
      moved: false
    }

    setIsDraggingBlocks(true)
    setDisplayPositions({})
    clearPreview()
  }

  const deleteSelected = useCallback((): void => {
    if (selectedNodeIds.length === 0) return

    removeNodeTree(selectedNodeIds[0])
    setSelectedNodeIds([])
  }, [removeNodeTree, selectedNodeIds])

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
