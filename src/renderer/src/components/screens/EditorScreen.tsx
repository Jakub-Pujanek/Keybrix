import { useEffect, useMemo, useRef } from 'react'
import BlocksLibraryPanel from '../composites/editor/BlocksLibraryPanel'
import CanvasControls from '../composites/editor/CanvasControls'
import CanvasGrid from '../composites/editor/CanvasGrid'
import EditorTopBar from '../composites/editor/EditorTopBar'
import { useEditorStore } from '../../store'
import { useEditorCanvasInteractions } from '../../hooks/useEditorCanvasInteractions'

function EditorScreen(): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const libraryPanelRef = useRef<HTMLDivElement | null>(null)

  const nodes = useEditorStore((state) => state.nodes)
  const zoom = useEditorStore((state) => state.zoom)
  const macroTitle = useEditorStore((state) => state.macroTitle)
  const shortcut = useEditorStore((state) => state.shortcut)
  const isRecordingShortcut = useEditorStore((state) => state.isRecordingShortcut)
  const recordingSource = useEditorStore((state) => state.recordingSource)
  const heldKeys = useEditorStore((state) => state.heldKeys)

  const loadEditorMacro = useEditorStore((state) => state.loadEditorMacro)
  const addNode = useEditorStore((state) => state.addNode)
  const setManyNodePositions = useEditorStore((state) => state.setManyNodePositions)
  const setNodeNext = useEditorStore((state) => state.setNodeNext)
  const clearIncomingConnection = useEditorStore((state) => state.clearIncomingConnection)
  const removeNodeTree = useEditorStore((state) => state.removeNodeTree)
  const updateNodePayload = useEditorStore((state) => state.updateNodePayload)
  const clearNodes = useEditorStore((state) => state.clearNodes)
  const setZoom = useEditorStore((state) => state.setZoom)
  const startShortcutRecording = useEditorStore((state) => state.startShortcutRecording)
  const cancelShortcutRecording = useEditorStore((state) => state.cancelShortcutRecording)
  const handleShortcutKeyDown = useEditorStore((state) => state.handleShortcutKeyDown)
  const handleShortcutKeyUp = useEditorStore((state) => state.handleShortcutKeyUp)
  const saveMacroFromEditor = useEditorStore((state) => state.saveMacroFromEditor)
  const testRunMacro = useEditorStore((state) => state.testRunMacro)

  const pressedPreview = useMemo(() => {
    if (heldKeys.length === 0) return ''
    return heldKeys
      .join(' + ')
      .replace(/(Left|Right)/g, '')
      .replace('Key', '')
  }, [heldKeys])

  const {
    snapPreviewParentId,
    snapPreviewChildId,
    displayPositions,
    isDraggingBlocks,
    selectedNodeIds,
    deleteSelected,
    handleBlockPointerDown
  } = useEditorCanvasInteractions({
    nodes,
    zoom,
    setManyNodePositions,
    setNodeNext,
    clearIncomingConnection,
    removeNodeTree,
    isDeleteZoneHit: (clientX, clientY) => {
      const rect = libraryPanelRef.current?.getBoundingClientRect()
      if (!rect) return false

      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      )
    }
  })

  useEffect(() => {
    void loadEditorMacro()
  }, [loadEditorMacro])

  useEffect(() => {
    if (!isRecordingShortcut) return

    const onKeyDown = (event: KeyboardEvent): void => {
      handleShortcutKeyDown(event)
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      void handleShortcutKeyUp(event)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [handleShortcutKeyDown, handleShortcutKeyUp, isRecordingShortcut])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return

      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      event.preventDefault()
      deleteSelected()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [deleteSelected])

  return (
    <section data-testid="editor-screen" className="min-w-0 space-y-4">
      <EditorTopBar
        macroTitle={macroTitle}
        shortcut={shortcut}
        isRecording={isRecordingShortcut && recordingSource === 'topbar'}
        pressedPreview={pressedPreview}
        onStartShortcutRecording={() => startShortcutRecording('topbar')}
        onCancelShortcutRecording={cancelShortcutRecording}
        onClear={clearNodes}
        onTestRun={() => {
          void testRunMacro()
        }}
        onSave={() => {
          void saveMacroFromEditor()
        }}
      />

      <div className="flex min-w-0 flex-col gap-4 xl:flex-row">
        <div ref={libraryPanelRef} className="relative z-20">
          <BlocksLibraryPanel onAddBlock={addNode} />
        </div>

        <div className={`relative min-w-0 flex-1 ${isDraggingBlocks ? 'z-[999]' : 'z-0'}`}>
          <CanvasGrid
            nodes={nodes}
            zoom={zoom}
            canvasRef={canvasRef}
            onZoomChange={setZoom}
            onBlockPointerDown={handleBlockPointerDown}
            snapPreviewParentId={snapPreviewParentId}
            snapPreviewChildId={snapPreviewChildId}
            displayPositions={displayPositions}
            isDraggingBlocks={isDraggingBlocks}
            onDropLibraryBlock={(type, x, y) => {
              addNode(type, { x, y })
            }}
            selectedNodeIds={selectedNodeIds}
            isRecordingStartShortcut={isRecordingShortcut && recordingSource === 'start-block'}
            pressedPreview={pressedPreview}
            onStartShortcutRecording={() => startShortcutRecording('start-block')}
            onCancelShortcutRecording={cancelShortcutRecording}
            onUpdatePayload={updateNodePayload}
          />

          <CanvasControls
            zoom={zoom}
            onZoomIn={() => setZoom(zoom + 0.1)}
            onZoomOut={() => setZoom(zoom - 0.1)}
            onZoomChange={setZoom}
          />
        </div>
      </div>
    </section>
  )
}

export default EditorScreen
