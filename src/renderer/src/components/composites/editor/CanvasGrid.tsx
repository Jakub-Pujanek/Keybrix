import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EditorBlockType, EditorNode } from '../../../../../shared/api'
import { isRegisteredEditorBlockType } from '../../../../../shared/block-registry'
import {
  clampZoom,
  WORLD_CENTER_X,
  WORLD_CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CameraPosition,
  type ViewportSize
} from '../../../lib/editor/canvasCamera'
import { resolveNodePositions } from '../../../lib/editor/canvasPhysics'
import ActionBlock from './ActionBlock'

type MeasuredBlockProps = {
  nodeId: string
  className: string
  style: React.CSSProperties
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  getObserver: () => ResizeObserver | null
  onMeasureHeights: (updates: Record<string, number>) => void
  children: React.ReactNode
}

function MeasuredBlock({
  nodeId,
  className,
  style,
  onPointerDown,
  getObserver,
  onMeasureHeights,
  children
}: MeasuredBlockProps): React.JSX.Element {
  const elementRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return

    // offsetHeight is in layout px, unaffected by the canvas zoom transform.
    const height = element.offsetHeight
    if (height > 0) onMeasureHeights({ [nodeId]: height })

    const observer = getObserver()
    if (!observer) return

    observer.observe(element)
    return () => observer.unobserve(element)
  }, [nodeId, getObserver, onMeasureHeights])

  return (
    <div
      ref={elementRef}
      data-editor-block="1"
      data-node-id={nodeId}
      className={className}
      style={style}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  )
}

type CanvasGridProps = {
  nodes: EditorNode[]
  nodeHeights: Record<string, number>
  zoom: number
  camera: CameraPosition
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCameraChange: (next: CameraPosition) => void
  onZoomAnchored: (nextZoom: number, anchorScreen: CameraPosition) => void
  onViewportResize: (size: ViewportSize) => void
  onBlockPointerDown: (nodeId: string, clientX: number, clientY: number) => void
  snapPreviewParentId: string | null
  snapPreviewChildId: string | null
  displayPositions: Record<string, { x: number; y: number }>
  isDraggingBlocks: boolean
  onDropLibraryBlock: (type: EditorBlockType, x: number, y: number) => void
  selectedNodeIds: string[]
  recordingShortcutNodeId: string | null
  pressedPreview: string
  onStartShortcutRecording: (nodeId: string, nodeType: EditorNode['type']) => void
  onCancelShortcutRecording: () => void
  onUpdatePayload: (nodeId: string, nextPayload: Record<string, unknown>) => void
  mousePickerTargetNodeId: string | null
  mousePickerPreview: { x: number; y: number } | null
  isMousePickerActive: boolean
  onStartMousePicker: (nodeId: string) => void
  onStopMousePicker: () => void
  onMeasureNodeHeights: (updates: Record<string, number>) => void
}

function CanvasGrid({
  nodes,
  nodeHeights,
  zoom,
  camera,
  canvasRef,
  onCameraChange,
  onZoomAnchored,
  onViewportResize,
  onBlockPointerDown,
  snapPreviewParentId,
  snapPreviewChildId,
  displayPositions,
  isDraggingBlocks,
  onDropLibraryBlock,
  selectedNodeIds,
  recordingShortcutNodeId,
  pressedPreview,
  onStartShortcutRecording,
  onCancelShortcutRecording,
  onUpdatePayload,
  mousePickerTargetNodeId,
  mousePickerPreview,
  isMousePickerActive,
  onStartMousePicker,
  onStopMousePicker,
  onMeasureNodeHeights
}: CanvasGridProps): React.JSX.Element {
  const [isPanningCanvas, setIsPanningCanvas] = useState(false)
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])
  const draggingNodeIds = useMemo(() => new Set(Object.keys(displayPositions)), [displayPositions])
  const activePanPointerIdRef = useRef<number | null>(null)
  const panStartRef = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(
    null
  )
  const measureCallbackRef = useRef(onMeasureNodeHeights)
  const blockObserverRef = useRef<ResizeObserver | null>(null)
  const zoomRef = useRef(zoom)
  const onCameraChangeRef = useRef(onCameraChange)
  const onZoomAnchoredRef = useRef(onZoomAnchored)
  const onViewportResizeRef = useRef(onViewportResize)
  const pendingCameraRef = useRef<CameraPosition | null>(null)
  const cameraFrameRef = useRef<number | null>(null)
  const pendingZoomRef = useRef<{ zoom: number; anchor: CameraPosition } | null>(null)

  const resolvedPositions = useMemo(
    () => resolveNodePositions(nodes, nodeHeights),
    [nodes, nodeHeights]
  )

  useEffect(() => {
    measureCallbackRef.current = onMeasureNodeHeights
  }, [onMeasureNodeHeights])

  useEffect(() => {
    zoomRef.current = zoom
    onCameraChangeRef.current = onCameraChange
    onZoomAnchoredRef.current = onZoomAnchored
    onViewportResizeRef.current = onViewportResize
  }, [zoom, onCameraChange, onZoomAnchored, onViewportResize])

  useEffect(
    () => () => {
      blockObserverRef.current?.disconnect()
      if (cameraFrameRef.current !== null) {
        window.cancelAnimationFrame(cameraFrameRef.current)
      }
    },
    []
  )

  const getBlockObserver = useCallback((): ResizeObserver | null => {
    if (typeof ResizeObserver === 'undefined') return null

    if (!blockObserverRef.current) {
      blockObserverRef.current = new ResizeObserver((entries) => {
        const updates: Record<string, number> = {}
        for (const entry of entries) {
          const element = entry.target as HTMLElement
          const nodeId = element.dataset['nodeId']
          if (!nodeId) continue

          const height = element.offsetHeight
          if (height > 0) updates[nodeId] = height
        }

        if (Object.keys(updates).length > 0) {
          measureCallbackRef.current(updates)
        }
      })
    }

    return blockObserverRef.current
  }, [])

  const handleUpdatePayload = useCallback(
    (nodeId: string, nextPayload: Record<string, unknown>) => {
      onUpdatePayload(nodeId, nextPayload)
    },
    [onUpdatePayload]
  )

  // Camera and zoom updates are rAF-batched: hi-res wheels and pointermove
  // can fire far above 60Hz, so only the latest pending value is applied per
  // frame. The store performs the world-bounds clamping.
  const scheduleCamera = useCallback((next: CameraPosition): void => {
    pendingCameraRef.current = next
    if (cameraFrameRef.current !== null) return

    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null
      const pending = pendingCameraRef.current
      pendingCameraRef.current = null
      if (pending) onCameraChangeRef.current(pending)
    })
  }, [])

  const scheduleZoom = useCallback((nextZoom: number, anchor: CameraPosition): void => {
    pendingZoomRef.current = { zoom: nextZoom, anchor }
    if (cameraFrameRef.current !== null) return

    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null
      const pendingCamera = pendingCameraRef.current
      pendingCameraRef.current = null
      if (pendingCamera) onCameraChangeRef.current(pendingCamera)

      const pending = pendingZoomRef.current
      pendingZoomRef.current = null
      if (pending) onZoomAnchoredRef.current(pending.zoom, pending.anchor)
    })
  }, [])

  // The store centers the world on the first real viewport measurement and
  // re-clamps the camera on every later resize.
  useEffect(() => {
    const viewport = canvasRef.current
    if (!viewport) return

    const report = (): void => {
      onViewportResizeRef.current({
        width: viewport.clientWidth,
        height: viewport.clientHeight
      })
    }

    report()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [canvasRef])

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if (isDraggingBlocks) return

    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('[data-editor-block="1"], [data-shortcut-recorder="1"]')
    ) {
      return
    }

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y
    }

    setIsPanningCanvas(true)
    activePanPointerIdRef.current = event.pointerId

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!isPanningCanvas) return
    if (activePanPointerIdRef.current !== event.pointerId) return

    const panStart = panStartRef.current
    if (!panStart) return

    const dx = event.clientX - panStart.x
    const dy = event.clientY - panStart.y

    // Reverse axis for map-like navigation: dragging left reveals right side of world.
    scheduleCamera({ x: panStart.cameraX - dx, y: panStart.cameraY - dy })
  }

  const finishCanvasPan = (): void => {
    setIsPanningCanvas(false)
    panStartRef.current = null
    activePanPointerIdRef.current = null
  }

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (activePanPointerIdRef.current !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    finishCanvasPan()
  }

  const handleCanvasPointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (activePanPointerIdRef.current !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    finishCanvasPan()
  }

  const handleCanvasLostPointerCapture = (): void => {
    finishCanvasPan()
  }

  useEffect(() => {
    if (!isPanningCanvas) return

    const forceStop = (): void => {
      finishCanvasPan()
    }

    window.addEventListener('pointerup', forceStop)
    window.addEventListener('blur', forceStop)
    window.addEventListener('mouseleave', forceStop)

    return () => {
      window.removeEventListener('pointerup', forceStop)
      window.removeEventListener('blur', forceStop)
      window.removeEventListener('mouseleave', forceStop)
    }
  }, [isPanningCanvas])

  // Reads everything through refs so the wheel listener attaches exactly once
  // instead of being rebound on every camera/zoom change.
  const handleCanvasWheel = useCallback(
    (event: WheelEvent): void => {
      const viewport = canvasRef.current
      if (!viewport) {
        return
      }

      event.preventDefault()

      const rect = viewport.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top

      const scale = Math.exp(-event.deltaY * 0.0018)
      const nextZoom = clampZoom(zoomRef.current * scale)
      if (nextZoom === zoomRef.current) return

      scheduleZoom(nextZoom, { x: pointerX, y: pointerY })
    },
    [canvasRef, scheduleZoom]
  )

  useEffect(() => {
    const viewport = canvasRef.current
    if (!viewport) {
      return
    }

    const onWheel = (event: WheelEvent): void => {
      handleCanvasWheel(event)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [canvasRef, handleCanvasWheel])

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    const blockType =
      event.dataTransfer.getData('application/x-keybrix-block-type') ||
      event.dataTransfer.getData('text/plain')

    if (isRegisteredEditorBlockType(blockType)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    const blockType =
      event.dataTransfer.getData('application/x-keybrix-block-type') ||
      event.dataTransfer.getData('text/plain')
    if (!isRegisteredEditorBlockType(blockType)) return

    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left + camera.x) / zoom - WORLD_CENTER_X
    const y = (event.clientY - rect.top + camera.y) / zoom - WORLD_CENTER_Y

    onDropLibraryBlock(blockType, x, y)
  }

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerCancel}
      onLostPointerCapture={handleCanvasLostPointerCapture}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      className={`relative h-full min-h-0 w-full rounded border border-(--kb-border) bg-(--kb-editor-canvas-bg) ${isDraggingBlocks ? 'overflow-visible' : 'overflow-hidden'} ${isPanningCanvas || isDraggingBlocks ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: `${WORLD_WIDTH}px`,
          height: `${WORLD_HEIGHT}px`,
          transform: `translate(${-camera.x}px, ${-camera.y}px) scale(${zoom})`,
          backgroundImage:
            'radial-gradient(circle, rgb(var(--kb-grid-dot-rgb) / 0.24) 1px, transparent 1px), radial-gradient(circle, rgb(var(--kb-grid-dot-rgb) / 0.12) 1px, transparent 1px)',
          backgroundSize: '22px 22px, 88px 88px',
          backgroundPosition: '0 0, 0 0'
        }}
      >
        {nodes.map((node) => {
          const display = displayPositions[node.id] ??
            resolvedPositions.get(node.id) ?? { x: node.x, y: node.y }

          return (
            <MeasuredBlock
              key={node.id}
              nodeId={node.id}
              className={`absolute cursor-grab active:cursor-grabbing ${draggingNodeIds.has(node.id) ? 'z-9999' : 'z-0'}`}
              style={{
                transform: `translate(${display.x + WORLD_CENTER_X}px, ${display.y + WORLD_CENTER_Y}px)`
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onBlockPointerDown(node.id, event.clientX, event.clientY)
              }}
              getObserver={getBlockObserver}
              onMeasureHeights={onMeasureNodeHeights}
            >
              <ActionBlock
                node={node}
                isSelected={selectedNodeIdsSet.has(node.id)}
                isRecordingShortcut={recordingShortcutNodeId === node.id}
                pressedPreview={pressedPreview}
                highlightTopNotch={snapPreviewChildId === node.id}
                highlightBottomNotch={snapPreviewParentId === node.id}
                onStartShortcutRecording={onStartShortcutRecording}
                onCancelShortcutRecording={onCancelShortcutRecording}
                onUpdatePayload={handleUpdatePayload}
                mousePickerTargetNodeId={mousePickerTargetNodeId}
                mousePickerPreview={mousePickerPreview}
                isMousePickerActive={isMousePickerActive}
                onStartMousePicker={onStartMousePicker}
                onStopMousePicker={onStopMousePicker}
              />
            </MeasuredBlock>
          )
        })}
      </div>
    </div>
  )
}

export default memo(CanvasGrid)
