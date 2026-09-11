import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorNode } from '../../../shared/api'
import {
  useEditorCanvasInteractions,
  type UseEditorCanvasInteractionsOutput
} from './useEditorCanvasInteractions'

const buildNode = (id: string, x: number, y: number, nextId: string | null = null): EditorNode => ({
  id,
  type: 'WAIT',
  x,
  y,
  nextId,
  payload: {}
})

const DEFAULT_CANVAS_RECT = { left: 0, top: 0, right: 1000, bottom: 800 }

const setupHook = (
  nodes: EditorNode[],
  options: {
    canvasRect?: { left: number; top: number; right: number; bottom: number }
    panCameraByImpl?: (dx: number, dy: number) => { x: number; y: number }
  } = {}
): {
  view: { result: { current: UseEditorCanvasInteractionsOutput } }
  setManyNodePositions: ReturnType<typeof vi.fn>
  setNodeNext: ReturnType<typeof vi.fn>
  clearIncomingConnection: ReturnType<typeof vi.fn>
  removeNodeTree: ReturnType<typeof vi.fn>
  panCameraBy: ReturnType<typeof vi.fn>
} => {
  const setManyNodePositions = vi.fn()
  const setNodeNext = vi.fn()
  const clearIncomingConnection = vi.fn()
  const removeNodeTree = vi.fn()
  const panCameraBy = vi.fn(
    options.panCameraByImpl ?? ((dx: number, dy: number) => ({ x: dx, y: dy }))
  )
  const rect = options.canvasRect ?? DEFAULT_CANVAS_RECT
  const canvasRef = {
    current: {
      getBoundingClientRect: () => rect
    } as HTMLDivElement
  }

  const view = renderHook(() =>
    useEditorCanvasInteractions({
      nodes,
      nodeHeights: {},
      zoom: 1,
      canvasRef,
      panCameraBy,
      setManyNodePositions,
      setNodeNext,
      clearIncomingConnection,
      removeNodeTree,
      isDeleteZoneHit: () => false
    })
  )

  return {
    view,
    setManyNodePositions,
    setNodeNext,
    clearIncomingConnection,
    removeNodeTree,
    panCameraBy
  }
}

const dispatchPointer = (type: 'pointermove' | 'pointerup', x: number, y: number): void => {
  window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }))
}

describe('useEditorCanvasInteractions', () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== 'function') {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        callback(0)
        return 0
      }) as typeof window.requestAnimationFrame
      window.cancelAnimationFrame = () => undefined
    }
  })

  it('splices the occupied slot child under the tail of the inserted chain', () => {
    const nodes = [
      buildNode('p', 0, 0, 'displaced'),
      buildNode('displaced', 0, 103),
      buildNode('r', 200, 300, 't'),
      buildNode('t', 200, 403)
    ]
    const { view, setNodeNext, clearIncomingConnection } = setupHook(nodes)

    act(() => {
      view.result.current.handleBlockPointerDown('r', 0, 0)
    })
    act(() => {
      dispatchPointer('pointermove', -200, -190)
    })
    act(() => {
      dispatchPointer('pointerup', -200, -190)
    })

    expect(clearIncomingConnection).toHaveBeenCalledWith('r')
    expect(setNodeNext).toHaveBeenCalledWith('p', 'r')
    expect(setNodeNext).toHaveBeenCalledWith('t', 'displaced')
  })

  it('does not splice when the target slot is free', () => {
    const nodes = [buildNode('p', 0, 0), buildNode('r', 200, 300, 't'), buildNode('t', 200, 403)]
    const { view, setNodeNext } = setupHook(nodes)

    act(() => {
      view.result.current.handleBlockPointerDown('r', 0, 0)
    })
    act(() => {
      dispatchPointer('pointermove', -200, -190)
    })
    act(() => {
      dispatchPointer('pointerup', -200, -190)
    })

    expect(setNodeNext).toHaveBeenCalledTimes(1)
    expect(setNodeNext).toHaveBeenCalledWith('p', 'r')
  })

  it('detaches the dragged chain when dropped away from any snap target', () => {
    const nodes = [buildNode('p', 0, 0), buildNode('r', 200, 300, 't'), buildNode('t', 200, 403)]
    const { view, setNodeNext, clearIncomingConnection, setManyNodePositions } = setupHook(nodes)

    act(() => {
      view.result.current.handleBlockPointerDown('r', 0, 0)
    })
    act(() => {
      dispatchPointer('pointermove', 50, 50)
    })
    act(() => {
      dispatchPointer('pointerup', 50, 50)
    })

    expect(setNodeNext).not.toHaveBeenCalled()
    expect(clearIncomingConnection).toHaveBeenCalledWith('r')
    expect(setManyNodePositions).toHaveBeenCalledWith([
      { id: 'r', x: 250, y: 350 },
      { id: 't', x: 250, y: 453 }
    ])
  })

  it('selects the whole chain on click without drag', () => {
    const nodes = [buildNode('r', 200, 300, 't'), buildNode('t', 200, 403)]
    const { view } = setupHook(nodes)

    act(() => {
      view.result.current.handleBlockPointerDown('r', 0, 0)
    })
    act(() => {
      dispatchPointer('pointerup', 0, 0)
    })

    expect(view.result.current.selectedNodeIds).toEqual(['r', 't'])
  })

  it('clamps dropped positions to the world bounds', () => {
    const nodes = [buildNode('r', 200, 300)]
    const { view, setManyNodePositions } = setupHook(nodes)

    act(() => {
      view.result.current.handleBlockPointerDown('r', 0, 0)
    })
    act(() => {
      dispatchPointer('pointermove', -5200, -2600)
    })
    act(() => {
      dispatchPointer('pointerup', -5200, -2600)
    })

    // raw (-5000, -2300) is clamped into [-3000, 3000-w] × [-2000, 2000-h].
    expect(setManyNodePositions).toHaveBeenCalledWith([{ id: 'r', x: -3000, y: -2000 }])
  })

  it('edge-pans the camera and keeps the chain glued to the pointer', () => {
    vi.useFakeTimers()

    try {
      const nodes = [buildNode('r', 200, 300)]
      const { view, panCameraBy, setManyNodePositions } = setupHook(nodes)

      act(() => {
        view.result.current.handleBlockPointerDown('r', 500, 400)
      })
      act(() => {
        dispatchPointer('pointermove', 990, 400)
      })
      act(() => {
        vi.advanceTimersByTime(64)
      })
      act(() => {
        dispatchPointer('pointerup', 990, 400)
      })

      expect(panCameraBy).toHaveBeenCalled()
      const lastDelta = panCameraBy.mock.calls.at(-1) as [number, number]
      expect(lastDelta[0]).toBeGreaterThan(0)

      // Pointer delta alone is 490 world px; the accumulated pan offset pushes
      // the drop position beyond it.
      const updates = setManyNodePositions.mock.calls.at(-1)?.[0] as Array<{
        id: string
        x: number
        y: number
      }>
      expect(updates[0]?.id).toBe('r')
      expect(updates[0]?.x).toBeGreaterThan(690)
    } finally {
      vi.useRealTimers()
    }
  })
})
