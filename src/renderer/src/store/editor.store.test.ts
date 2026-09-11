import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordShortcutResult } from '../../../shared/api'

let useEditorStore: (typeof import('./editor.store'))['useEditorStore']

const previewUnsubscribe = vi.fn()
const selectedUnsubscribe = vi.fn()

let onPreviewUpdateListener:
  | ((payload: { x: number; y: number; isActive: boolean; timestamp: string }) => void)
  | null = null

let onCoordinateSelectedListener:
  | ((payload: { x: number; y: number; timestamp: string }) => void)
  | null = null

const mousePickerStartMock = vi.fn(async () => true)
const mousePickerStopMock = vi.fn(async () => true)
const recordShortcutMock = vi.fn(
  async (): Promise<RecordShortcutResult> => ({
    success: true,
    reasonCode: 'OK'
  })
)
const setCaptureActiveMock = vi.fn(async () => true)

const setupApiMock = (): void => {
  ;(window as { api: unknown }).api = {
    keyboard: {
      recordShortcut: recordShortcutMock,
      setCaptureActive: setCaptureActiveMock
    },
    mousePicker: {
      start: mousePickerStartMock,
      stop: mousePickerStopMock,
      onPreviewUpdate: vi.fn((callback) => {
        onPreviewUpdateListener = callback
        return previewUnsubscribe
      }),
      onCoordinateSelected: vi.fn((callback) => {
        onCoordinateSelectedListener = callback
        return selectedUnsubscribe
      })
    }
  } as unknown
}

describe('editor.store mouse picker', () => {
  beforeEach(async () => {
    vi.resetModules()
    mousePickerStartMock.mockClear()
    mousePickerStopMock.mockClear()
    recordShortcutMock.mockClear()
    setCaptureActiveMock.mockClear()
    previewUnsubscribe.mockClear()
    selectedUnsubscribe.mockClear()
    onPreviewUpdateListener = null
    onCoordinateSelectedListener = null
    setupApiMock()
    ;({ useEditorStore } = await import('./editor.store'))
    useEditorStore.setState({
      nodes: [
        {
          id: 'node-mouse-1',
          type: 'MOUSE_CLICK',
          x: 0,
          y: 0,
          nextId: null,
          payload: {
            label: 'Mouse Click',
            x: 15,
            y: 25,
            button: 'LEFT'
          }
        }
      ],
      mousePickerTargetNodeId: null,
      mousePickerPreview: null,
      isMousePickerActive: false
    })
  })

  it('updates node x/y after stop when coordinateSelected arrives asynchronously', async () => {
    await useEditorStore.getState().startMousePicker('node-mouse-1')

    expect(mousePickerStartMock).toHaveBeenCalledTimes(1)
    expect(useEditorStore.getState().mousePickerTargetNodeId).toBe('node-mouse-1')

    const stopPromise = useEditorStore.getState().stopMousePicker()

    expect(mousePickerStopMock).toHaveBeenCalledTimes(1)
    expect(useEditorStore.getState().isMousePickerActive).toBe(false)

    onCoordinateSelectedListener?.({
      x: 321,
      y: 654,
      timestamp: '2026-04-21T00:00:00.000Z'
    })

    await stopPromise

    const node = useEditorStore.getState().nodes[0]
    expect(node?.payload.x).toBe(321)
    expect(node?.payload.y).toBe(654)
    expect(useEditorStore.getState().mousePickerTargetNodeId).toBeNull()
  })

  it('ignores concurrent stop calls and preserves coordinate commit', async () => {
    const resolveStopRef: { current: (() => void) | null } = { current: null }
    mousePickerStopMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStopRef.current = () => resolve(true)
        })
    )

    await useEditorStore.getState().startMousePicker('node-mouse-1')

    const firstStop = useEditorStore.getState().stopMousePicker()
    const secondStop = useEditorStore.getState().stopMousePicker()

    expect(mousePickerStopMock).toHaveBeenCalledTimes(1)

    onCoordinateSelectedListener?.({
      x: 888,
      y: 999,
      timestamp: '2026-04-21T00:00:00.000Z'
    })

    if (resolveStopRef.current) {
      resolveStopRef.current()
    }
    await Promise.all([firstStop, secondStop])

    const node = useEditorStore.getState().nodes[0]
    expect(node?.payload.x).toBe(888)
    expect(node?.payload.y).toBe(999)
    expect(useEditorStore.getState().mousePickerTargetNodeId).toBeNull()
  })

  it('falls back to preview point when stop succeeds without coordinateSelected event', async () => {
    await useEditorStore.getState().startMousePicker('node-mouse-1')

    onPreviewUpdateListener?.({
      x: 432,
      y: 876,
      isActive: true,
      timestamp: '2026-04-21T00:00:00.000Z'
    })

    await useEditorStore.getState().stopMousePicker()

    const node = useEditorStore.getState().nodes[0]
    expect(node?.payload.x).toBe(432)
    expect(node?.payload.y).toBe(876)
    expect(useEditorStore.getState().mousePickerTargetNodeId).toBeNull()
  })

  it('sanitizes selected coordinates before writing to payload', async () => {
    await useEditorStore.getState().startMousePicker('node-mouse-1')

    onCoordinateSelectedListener?.({
      x: -18.6,
      y: 91.2,
      timestamp: '2026-04-21T00:00:00.000Z'
    })

    const node = useEditorStore.getState().nodes[0]
    expect(node?.payload.x).toBe(0)
    expect(node?.payload.y).toBe(91)
  })

  it('resets to safe editor state when active macro no longer exists', () => {
    useEditorStore.setState({
      activeMacroId: 'missing-macro',
      macroTitle: 'Stale Macro',
      shortcut: 'CTRL + X',
      nodes: []
    })

    useEditorStore.getState().ensureActiveMacroInvariant(['macro-2'])

    const state = useEditorStore.getState()
    expect(state.activeMacroId).toBeNull()
    expect(state.macroTitle).toBe('My First Macro')
    expect(state.shortcut).toBe('CTRL + SHIFT + M')
    expect(state.nodes.length).toBeGreaterThan(0)
  })

  it('keeps existing shortcut and stores conflict error when recorded shortcut is already taken', async () => {
    recordShortcutMock.mockResolvedValueOnce({
      success: false,
      reasonCode: 'CONFLICT',
      conflictMacroName: 'Busy Macro'
    })

    useEditorStore.setState({
      activeMacroId: 'macro-1',
      shortcut: 'CTRL + SHIFT + M'
    })

    useEditorStore.getState().startShortcutRecording('topbar')
    useEditorStore
      .getState()
      .handleShortcutKeyDown(new KeyboardEvent('keydown', { code: 'ControlLeft' }))
    useEditorStore
      .getState()
      .handleShortcutKeyDown(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    useEditorStore.getState().handleShortcutKeyDown(new KeyboardEvent('keydown', { code: 'KeyR' }))

    await useEditorStore
      .getState()
      .handleShortcutKeyUp(new KeyboardEvent('keyup', { code: 'KeyR' }))
    await useEditorStore
      .getState()
      .handleShortcutKeyUp(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))
    await useEditorStore
      .getState()
      .handleShortcutKeyUp(new KeyboardEvent('keyup', { code: 'ControlLeft' }))

    const state = useEditorStore.getState()
    expect(state.shortcut).toBe('CTRL + SHIFT + M')
    expect(state.shortcutRecordingError).toEqual({
      reasonCode: 'CONFLICT',
      keys: 'CTRL + SHIFT + R',
      conflictMacroName: 'Busy Macro'
    })
    expect(recordShortcutMock).toHaveBeenCalledWith({
      keys: 'CTRL + SHIFT + R',
      source: 'topbar',
      macroId: 'macro-1'
    })
    expect(setCaptureActiveMock).toHaveBeenCalledWith(true)
    expect(setCaptureActiveMock).toHaveBeenCalledWith(false)
  })

  it('stores measured node heights in batch', () => {
    useEditorStore.getState().setNodeHeights({ a: 120, b: 200 })

    expect(useEditorStore.getState().nodeHeights).toEqual({ a: 120, b: 200 })
  })

  it('skips the heights update when all measured values are unchanged', () => {
    useEditorStore.getState().setNodeHeights({ a: 120 })
    const before = useEditorStore.getState().nodeHeights

    useEditorStore.getState().setNodeHeights({ a: 120 })

    expect(useEditorStore.getState().nodeHeights).toBe(before)
  })

  it('centers the camera on the world on the first viewport measurement', () => {
    useEditorStore.setState({
      zoom: 1,
      camera: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 }
    })

    useEditorStore.getState().setViewportSize({ width: 1000, height: 800 })

    const state = useEditorStore.getState()
    expect(state.viewportSize).toEqual({ width: 1000, height: 800 })
    expect(state.camera).toEqual({ x: 2500, y: 1600 })
  })

  it('re-clamps the camera when the viewport grows beyond the world', () => {
    useEditorStore.setState({ zoom: 1, viewportSize: { width: 0, height: 0 } })
    useEditorStore.getState().setViewportSize({ width: 1000, height: 800 })

    useEditorStore.getState().setViewportSize({ width: 10000, height: 800 })

    // World is 6000px wide at zoom 1 → centered horizontally, clamped on y.
    expect(useEditorStore.getState().camera).toEqual({ x: -2000, y: 1600 })
  })

  it('anchors control-driven zoom on the viewport center', () => {
    useEditorStore.setState({ zoom: 1, viewportSize: { width: 0, height: 0 } })
    useEditorStore.getState().setViewportSize({ width: 1000, height: 800 })

    useEditorStore.getState().setZoomAnchored(2)

    const state = useEditorStore.getState()
    expect(state.zoom).toBe(2)
    // The world point under the viewport center stays put: (3000, 2000).
    expect((500 + state.camera.x) / 2).toBeCloseTo(3000)
    expect((400 + state.camera.y) / 2).toBeCloseTo(2000)
  })

  it('panCameraBy clamps and returns only the applied delta', () => {
    useEditorStore.setState({
      zoom: 1,
      viewportSize: { width: 1000, height: 800 },
      camera: { x: 0, y: 0 }
    })

    const applied = useEditorStore.getState().panCameraBy(-500, 100)

    expect(applied).toEqual({ x: 0, y: 100 })
    expect(useEditorStore.getState().camera).toEqual({ x: 0, y: 100 })
  })

  it('restores a removed subtree with its incoming link and heights', () => {
    useEditorStore.setState({
      nodes: [
        { id: 'p', type: 'WAIT', x: 0, y: 0, nextId: 'c', payload: {} },
        { id: 'c', type: 'WAIT', x: 0, y: 103, nextId: 'g', payload: {} },
        { id: 'g', type: 'WAIT', x: 0, y: 206, nextId: null, payload: {} }
      ],
      nodeHeights: { c: 150 },
      removedTreeSnapshot: null
    })

    useEditorStore.getState().removeNodeTree('c')

    let state = useEditorStore.getState()
    expect(state.nodes.map((node) => node.id)).toEqual(['p'])
    expect(state.nodes[0]?.nextId).toBeNull()

    useEditorStore.getState().restoreLastRemovedTree()

    state = useEditorStore.getState()
    expect(state.nodes.map((node) => node.id).sort()).toEqual(['c', 'g', 'p'])
    expect(state.nodes.find((node) => node.id === 'p')?.nextId).toBe('c')
    expect(state.nodes.find((node) => node.id === 'c')?.nextId).toBe('g')
    expect(state.nodeHeights['c']).toBe(150)
    expect(state.removedTreeSnapshot).toBeNull()
  })

  it('restores nodes cleared via clearNodes', () => {
    useEditorStore.setState({
      nodes: [{ id: 'a', type: 'WAIT', x: 0, y: 0, nextId: null, payload: {} }],
      nodeHeights: {},
      removedTreeSnapshot: null
    })

    useEditorStore.getState().clearNodes()
    expect(useEditorStore.getState().nodes).toEqual([])

    useEditorStore.getState().restoreLastRemovedTree()
    expect(useEditorStore.getState().nodes.map((node) => node.id)).toEqual(['a'])
  })

  it('generates unique node ids on rapid addNode calls', () => {
    useEditorStore.setState({ nodes: [] })

    useEditorStore.getState().addNode('WAIT')
    useEditorStore.getState().addNode('WAIT')

    const [first, second] = useEditorStore.getState().nodes
    expect(first?.id).not.toBe(second?.id)
  })
})
