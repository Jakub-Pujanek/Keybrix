import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const setupApiMock = (): void => {
  ;(window as { api: unknown }).api = {
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
})
