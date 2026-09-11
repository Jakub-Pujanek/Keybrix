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

const setupHook = (
  nodes: EditorNode[]
): {
  view: { result: { current: UseEditorCanvasInteractionsOutput } }
  setManyNodePositions: ReturnType<typeof vi.fn>
  setNodeNext: ReturnType<typeof vi.fn>
  clearIncomingConnection: ReturnType<typeof vi.fn>
  removeNodeTree: ReturnType<typeof vi.fn>
} => {
  const setManyNodePositions = vi.fn()
  const setNodeNext = vi.fn()
  const clearIncomingConnection = vi.fn()
  const removeNodeTree = vi.fn()

  const view = renderHook(() =>
    useEditorCanvasInteractions({
      nodes,
      nodeHeights: {},
      zoom: 1,
      setManyNodePositions,
      setNodeNext,
      clearIncomingConnection,
      removeNodeTree,
      isDeleteZoneHit: () => false
    })
  )

  return { view, setManyNodePositions, setNodeNext, clearIncomingConnection, removeNodeTree }
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
})
