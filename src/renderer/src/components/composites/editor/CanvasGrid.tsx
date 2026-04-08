import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorBlockType, EditorNode } from '../../../../../shared/api'
import { isRegisteredEditorBlockType } from '../../../../../shared/block-registry'
import ActionBlock from './ActionBlock'

const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const WORLD_CENTER_X = WORLD_WIDTH / 2
const WORLD_CENTER_Y = WORLD_HEIGHT / 2

type CanvasGridProps = {
  nodes: EditorNode[]
  zoom: number
  canvasRef: React.RefObject<HTMLDivElement | null>
  onZoomChange: (nextZoom: number) => void
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
}

function CanvasGrid({
  nodes,
  zoom,
  canvasRef,
  onZoomChange,
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
  onUpdatePayload
}: CanvasGridProps): React.JSX.Element {
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [isPanningCanvas, setIsPanningCanvas] = useState(false)
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])
  const draggingNodeIds = useMemo(() => new Set(Object.keys(displayPositions)), [displayPositions])
  const activePanPointerIdRef = useRef<number | null>(null)
  const hasInitializedCameraRef = useRef(false)
  const panStartRef = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(
    null
  )

  const handleUpdatePayload = useCallback(
    (nodeId: string, nextPayload: Record<string, unknown>) => {
      onUpdatePayload(nodeId, nextPayload)
    },
    [onUpdatePayload]
  )

  const clampCamera = useCallback(
    (nextX: number, nextY: number, nextZoom: number): { x: number; y: number } => {
      const viewport = canvasRef.current
      if (!viewport) {
        return {
          x: Math.max(0, nextX),
          y: Math.max(0, nextY)
        }
      }

      const visibleWidth = viewport.clientWidth
      const visibleHeight = viewport.clientHeight
      const maxX = Math.max(0, WORLD_WIDTH * nextZoom - visibleWidth)
      const maxY = Math.max(0, WORLD_HEIGHT * nextZoom - visibleHeight)

      return {
        x: Math.min(Math.max(0, nextX), maxX),
        y: Math.min(Math.max(0, nextY), maxY)
      }
    },
    [canvasRef]
  )

  useEffect(() => {
    if (hasInitializedCameraRef.current) return

    const viewport = canvasRef.current
    if (!viewport) return

    hasInitializedCameraRef.current = true
    setCamera(
      clampCamera(
        WORLD_CENTER_X * zoom - viewport.clientWidth / 2,
        WORLD_CENTER_Y * zoom - viewport.clientHeight / 2,
        zoom
      )
    )
  }, [canvasRef, clampCamera, zoom])

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
    setCamera(clampCamera(panStart.cameraX - dx, panStart.cameraY - dy, zoom))
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

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    const scale = Math.exp(-event.deltaY * 0.0018)
    const nextZoom = Math.min(2, Math.max(0.5, zoom * scale))
    if (nextZoom === zoom) return

    const worldX = (pointerX + camera.x) / zoom
    const worldY = (pointerY + camera.y) / zoom

    const nextCamera = clampCamera(
      worldX * nextZoom - pointerX,
      worldY * nextZoom - pointerY,
      nextZoom
    )

    setCamera(nextCamera)

    onZoomChange(nextZoom)
  }

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
      onWheel={handleCanvasWheel}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      className={`relative h-[calc(100vh-210px)] rounded border border-[var(--kb-border)] bg-[var(--kb-editor-canvas-bg)] ${isDraggingBlocks ? 'overflow-visible' : 'overflow-hidden'} ${isPanningCanvas || isDraggingBlocks ? 'cursor-grabbing' : 'cursor-grab'}`}
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
          const display = displayPositions[node.id] ?? { x: node.x, y: node.y }

          return (
            <div
              key={node.id}
              data-editor-block="1"
              className={`absolute cursor-grab active:cursor-grabbing ${draggingNodeIds.has(node.id) ? 'z-[9999]' : 'z-0'}`}
              style={{
                transform: `translate(${display.x + WORLD_CENTER_X}px, ${display.y + WORLD_CENTER_Y}px)`
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onBlockPointerDown(node.id, event.clientX, event.clientY)
              }}
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
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(CanvasGrid)
