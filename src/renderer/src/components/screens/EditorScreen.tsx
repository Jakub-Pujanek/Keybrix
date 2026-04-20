import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityLog, ManualRunResult } from '../../../../shared/api'
import BlocksLibraryPanel from '../composites/editor/BlocksLibraryPanel'
import CanvasControls from '../composites/editor/CanvasControls'
import CanvasGrid from '../composites/editor/CanvasGrid'
import EditorTopBar from '../composites/editor/EditorTopBar'
import TestRunModal from '../composites/editor/TestRunModal'
import { useEditorStore } from '../../store'
import { useEditorCanvasInteractions } from '../../hooks/useEditorCanvasInteractions'
import { useActivityStore } from '../../store/activity.store'

type TestRunStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'BLOCKED' | 'TIMEOUT' | 'ERROR'

const TEST_RUN_LOG_FETCH_RETRIES = 3
const TEST_RUN_LOG_FETCH_DELAY_MS = 120

const KNOWN_REASON_CODES = new Set<ManualRunResult['reasonCode']>([
  'SUCCESS',
  'MACRO_NOT_FOUND',
  'ALREADY_RUNNING',
  'NOT_RUNNING',
  'GLOBAL_MASTER_OFF',
  'WAYLAND_BLOCKED',
  'COMMAND_TIMEOUT',
  'COMMAND_ERROR',
  'RUNNER_FAILED',
  'COMPILE_ERROR',
  'ABORTED',
  'UNKNOWN',
  'SAVE_FAILED',
  'INVALID_MACRO_ID',
  'IPC_ERROR'
])

const collectLogsSinceMarker = (logs: ActivityLog[], markerLogId: string | null): ActivityLog[] => {
  if (!markerLogId) {
    return logs.slice(0, 24)
  }

  const scoped: ActivityLog[] = []
  for (const log of logs) {
    if (log.id === markerLogId) {
      break
    }
    scoped.push(log)
  }

  return scoped
}

const collectNewLogsSinceSnapshot = (
  logs: ActivityLog[],
  baselineLogIds: Set<string>
): ActivityLog[] => {
  return logs.filter((log) => !baselineLogIds.has(log.id)).slice(0, 24)
}

const collectRunLogs = (
  logs: ActivityLog[],
  runId: string | null,
  markerLogId: string | null
): ActivityLog[] => {
  if (runId) {
    return logs.filter((log) => log.runId === runId).slice(0, 24)
  }

  return collectLogsSinceMarker(logs, markerLogId)
}

const inferReasonCodeFromLogs = (logs: ActivityLog[]): ManualRunResult['reasonCode'] | null => {
  for (const log of logs) {
    const match = /with reason '([A-Z_]+)'/.exec(log.message)
    if (!match) continue

    const candidate = match[1]
    if (KNOWN_REASON_CODES.has(candidate as ManualRunResult['reasonCode'])) {
      return candidate as ManualRunResult['reasonCode']
    }
  }

  for (const log of logs) {
    if (log.message.includes('Wayland blocks simulated keyboard/mouse input')) {
      return 'WAYLAND_BLOCKED'
    }
  }

  return null
}

const sleep = (delayMs: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

const fetchLogsWithRetries = async (
  loadRecentLogs: () => Promise<ActivityLog[]>,
  baselineLogIds: Set<string>,
  targetRunId: string | null
): Promise<ActivityLog[]> => {
  let latest: ActivityLog[] = []

  for (let attempt = 0; attempt < TEST_RUN_LOG_FETCH_RETRIES; attempt += 1) {
    latest = await loadRecentLogs().catch(() => [])
    if (latest.length > 0) {
      const hasRunScoped = targetRunId ? latest.some((log) => log.runId === targetRunId) : false
      const hasNewLogs = latest.some((log) => !baselineLogIds.has(log.id))

      if (hasRunScoped || hasNewLogs) {
        return latest
      }
    }

    if (attempt < TEST_RUN_LOG_FETCH_RETRIES - 1) {
      await sleep(TEST_RUN_LOG_FETCH_DELAY_MS)
    }
  }

  return latest
}

const getLiveActivityLogs = (): ActivityLog[] => {
  return useActivityStore.getState().logs
}

const collectAttemptLogs = (logs: ActivityLog[], attemptId: string): ActivityLog[] => {
  const token = `[attempt=${attemptId}]`
  const quotedToken = `attempt='${attemptId}'`
  return logs.filter((log) => log.message.includes(token) || log.message.includes(quotedToken))
}

const buildSyntheticDiagnosticLog = (
  result: ManualRunResult,
  classifiedMessage: string,
  attemptId: string
): ActivityLog => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  return {
    id: `ui-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: `[${hh}:${mm}:${ss}]`,
    level: result.reasonCode === 'WAYLAND_BLOCKED' ? 'WARN' : 'ERR',
    runId: result.runId,
    message: `${classifiedMessage} [reason=${result.reasonCode}] [attempt=${attemptId}]`
  }
}

const classifyRunFailure = (
  result: ManualRunResult
): { status: TestRunStatus; message: string } => {
  if (result.reasonCode === 'ALREADY_RUNNING') {
    return {
      status: 'BLOCKED',
      message: 'To makro jest juz uruchomione.'
    }
  }

  if (result.reasonCode === 'NOT_RUNNING') {
    return {
      status: 'BLOCKED',
      message: 'To makro nie jest aktualnie uruchomione.'
    }
  }

  if (result.reasonCode === 'MACRO_NOT_FOUND') {
    return {
      status: 'ERROR',
      message: 'Nie znaleziono makra do uruchomienia testu.'
    }
  }

  if (result.reasonCode === 'INVALID_MACRO_ID') {
    return {
      status: 'ERROR',
      message: 'Nieprawidlowy identyfikator makra.'
    }
  }

  if (result.reasonCode === 'SAVE_FAILED') {
    return {
      status: 'ERROR',
      message: 'Nie udalo sie zapisac makra przed uruchomieniem testu.'
    }
  }

  if (result.reasonCode === 'GLOBAL_MASTER_OFF') {
    return {
      status: 'BLOCKED',
      message: 'Global Master jest wylaczony. Wlacz go w ustawieniach.'
    }
  }

  if (result.reasonCode === 'WAYLAND_BLOCKED') {
    return {
      status: 'BLOCKED',
      message: 'Srodowisko Wayland blokuje symulowane wejscie. Przelacz sesje na X11.'
    }
  }

  if (result.reasonCode === 'COMMAND_TIMEOUT') {
    return {
      status: 'TIMEOUT',
      message: 'Komenda runtime przekroczyla limit czasu. Sprawdz logi wykonania.'
    }
  }

  if (result.reasonCode === 'RUNNER_FAILED' || result.reasonCode === 'COMMAND_ERROR') {
    return {
      status: 'ERROR',
      message: 'Runtime makra zakonczyl sie bledem. Sprawdz logi wykonania.'
    }
  }

  if (result.reasonCode === 'IPC_ERROR') {
    return {
      status: 'ERROR',
      message: 'Blad komunikacji IPC miedzy renderer a main.'
    }
  }

  return {
    status: 'ERROR',
    message: `Nie udalo sie uruchomic testu makra. Kod: ${result.reasonCode}.`
  }
}

function EditorScreen(): React.JSX.Element {
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testRunStatus, setTestRunStatus] = useState<TestRunStatus>('IDLE')
  const [testRunSessionId, setTestRunSessionId] = useState<string | null>(null)
  const [testRunReasonCode, setTestRunReasonCode] = useState<string | null>(null)
  const [testRunMarkerLogId, setTestRunMarkerLogId] = useState<string | null>(null)
  const [testRunLogs, setTestRunLogs] = useState<ActivityLog[]>([])
  const [testError, setTestError] = useState<string | null>(null)
  const [sandboxText, setSandboxText] = useState('')
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const libraryPanelRef = useRef<HTMLDivElement | null>(null)

  const nodes = useEditorStore((state) => state.nodes)
  const zoom = useEditorStore((state) => state.zoom)
  const activeMacroId = useEditorStore((state) => state.activeMacroId)
  const macroTitle = useEditorStore((state) => state.macroTitle)
  const shortcut = useEditorStore((state) => state.shortcut)
  const isRecordingShortcut = useEditorStore((state) => state.isRecordingShortcut)
  const recordingSource = useEditorStore((state) => state.recordingSource)
  const recordingNodeId = useEditorStore((state) => state.recordingNodeId)
  const heldKeys = useEditorStore((state) => state.heldKeys)

  const loadEditorMacro = useEditorStore((state) => state.loadEditorMacro)
  const setMacroTitle = useEditorStore((state) => state.setMacroTitle)
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
  const stopTestRunMacro = useEditorStore((state) => state.stopTestRunMacro)
  const mousePickerTargetNodeId = useEditorStore((state) => state.mousePickerTargetNodeId)
  const mousePickerPreview = useEditorStore((state) => state.mousePickerPreview)
  const isMousePickerActive = useEditorStore((state) => state.isMousePickerActive)
  const startMousePicker = useEditorStore((state) => state.startMousePicker)
  const stopMousePicker = useEditorStore((state) => state.stopMousePicker)
  const clearMousePickerPreview = useEditorStore((state) => state.clearMousePickerPreview)
  const recentLogs = useActivityStore((state) => state.logs)
  const loadRecentLogs = useActivityStore((state) => state.loadRecentLogs)
  const subscribeRealtimeLogs = useActivityStore((state) => state.subscribeRealtimeLogs)

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
    if (activeMacroId) return
    void loadEditorMacro()
  }, [activeMacroId, loadEditorMacro])

  useEffect(() => {
    void loadRecentLogs()
    return subscribeRealtimeLogs()
  }, [loadRecentLogs, subscribeRealtimeLogs])

  useEffect(() => {
    if (!isTestModalOpen) return
    void loadRecentLogs().then((logs) => {
      setTestRunLogs(collectRunLogs(logs, testRunSessionId, testRunMarkerLogId))
    })
  }, [isTestModalOpen, loadRecentLogs, testRunMarkerLogId, testRunSessionId])

  useEffect(() => {
    if (!isTestModalOpen) return
    if (testRunStatus !== 'RUNNING') return

    setTestRunLogs(collectRunLogs(recentLogs, testRunSessionId, testRunMarkerLogId))
  }, [isTestModalOpen, recentLogs, testRunMarkerLogId, testRunSessionId, testRunStatus])

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

  useEffect(() => {
    return () => {
      void stopMousePicker().catch(() => undefined)
      clearMousePickerPreview()
    }
  }, [clearMousePickerPreview, stopMousePicker])

  return (
    <section
      data-testid="editor-screen"
      className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden"
    >
      <EditorTopBar
        macroTitle={macroTitle}
        shortcut={shortcut}
        isRecording={isRecordingShortcut && recordingSource === 'topbar'}
        pressedPreview={pressedPreview}
        onMacroTitleChange={setMacroTitle}
        onStartShortcutRecording={() => startShortcutRecording('topbar')}
        onCancelShortcutRecording={cancelShortcutRecording}
        onClear={clearNodes}
        onTestRun={() => {
          setIsTestModalOpen(true)
          setTestError(null)
          setTestRunStatus('IDLE')
          setTestRunSessionId(null)
          setTestRunReasonCode(null)
          setTestRunMarkerLogId(null)
          setTestRunLogs([])
        }}
        onSave={() => {
          void saveMacroFromEditor()
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden">
        <div ref={libraryPanelRef} className="relative z-20 min-h-0 shrink-0">
          <BlocksLibraryPanel onAddBlock={addNode} />
        </div>

        <div className={`relative min-h-0 min-w-0 flex-1 ${isDraggingBlocks ? 'z-999' : 'z-0'}`}>
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
            recordingShortcutNodeId={isRecordingShortcut ? recordingNodeId : null}
            pressedPreview={pressedPreview}
            onStartShortcutRecording={(nodeId, nodeType) => {
              if (nodeType === 'PRESS_KEY' || nodeType === 'HOLD_KEY') {
                startShortcutRecording('press-key-block', nodeId)
                return
              }

              if (nodeType === 'EXECUTE_SHORTCUT') {
                startShortcutRecording('execute-shortcut-block', nodeId)
                return
              }

              startShortcutRecording('start-block', nodeId)
            }}
            onCancelShortcutRecording={cancelShortcutRecording}
            onUpdatePayload={updateNodePayload}
            mousePickerTargetNodeId={mousePickerTargetNodeId}
            mousePickerPreview={mousePickerPreview}
            isMousePickerActive={isMousePickerActive}
            onStartMousePicker={(nodeId) => {
              void startMousePicker(nodeId)
            }}
            onStopMousePicker={() => {
              void stopMousePicker()
            }}
          />

          <CanvasControls
            zoom={zoom}
            onZoomIn={() => setZoom(zoom + 0.1)}
            onZoomOut={() => setZoom(zoom - 0.1)}
            onZoomChange={setZoom}
          />
        </div>
      </div>

      <TestRunModal
        isOpen={isTestModalOpen}
        isRunning={isTestRunning}
        status={testRunStatus}
        sessionId={testRunSessionId}
        reasonCode={testRunReasonCode}
        sandboxText={sandboxText}
        logs={testRunLogs}
        error={testError}
        onSandboxTextChange={setSandboxText}
        onRun={async () => {
          const attemptId = globalThis.crypto.randomUUID()
          const markerLogId = recentLogs[0]?.id ?? null
          const baselineLogIds = new Set(recentLogs.map((log) => log.id))

          setIsTestRunning(true)
          setTestRunStatus('RUNNING')
          setTestRunSessionId(null)
          setTestRunReasonCode(null)
          setTestRunMarkerLogId(markerLogId)
          setTestRunLogs([])
          setTestError(null)

          try {
            const result = await testRunMacro({ attemptId })
            const refreshedLogs = await fetchLogsWithRetries(
              loadRecentLogs,
              baselineLogIds,
              result.runId
            )
            const liveLogs = getLiveActivityLogs()
            const effectiveLogs = refreshedLogs.length > 0 ? refreshedLogs : liveLogs
            const runScopedLogs = collectRunLogs(effectiveLogs, result.runId, markerLogId)
            const newLogs = collectNewLogsSinceSnapshot(effectiveLogs, baselineLogIds)
            const markerFallbackLogs = collectLogsSinceMarker(effectiveLogs, markerLogId)

            let effectiveResult = result
            if (result.reasonCode === 'IPC_ERROR') {
              const attemptLogs = collectAttemptLogs(effectiveLogs, attemptId)
              const inferencePool =
                attemptLogs.length > 0
                  ? attemptLogs
                  : newLogs.length > 0
                    ? newLogs
                    : markerFallbackLogs
              const inferredReasonCode = inferReasonCodeFromLogs(inferencePool)
              const inferredRunId = inferencePool.find((log) => log.runId)?.runId ?? result.runId

              if (inferredReasonCode && inferredReasonCode !== 'IPC_ERROR') {
                effectiveResult = {
                  ...result,
                  runId: inferredRunId,
                  reasonCode: inferredReasonCode,
                  success: inferredReasonCode === 'SUCCESS'
                }
              }

              if (!inferredReasonCode) {
                await sleep(TEST_RUN_LOG_FETCH_DELAY_MS)
                const postMortemLogs = getLiveActivityLogs()
                const postMortemAttemptLogs = collectAttemptLogs(postMortemLogs, attemptId)
                const postMortemPool =
                  postMortemAttemptLogs.length > 0
                    ? postMortemAttemptLogs
                    : collectNewLogsSinceSnapshot(postMortemLogs, baselineLogIds)
                const postMortemReasonCode = inferReasonCodeFromLogs(postMortemPool)
                const postMortemRunId =
                  postMortemPool.find((log) => log.runId)?.runId ?? effectiveResult.runId

                if (postMortemReasonCode && postMortemReasonCode !== 'IPC_ERROR') {
                  effectiveResult = {
                    ...effectiveResult,
                    runId: postMortemRunId,
                    reasonCode: postMortemReasonCode,
                    success: postMortemReasonCode === 'SUCCESS'
                  }
                }
              }
            }

            const scopedLogs =
              runScopedLogs.length > 0
                ? runScopedLogs
                : newLogs.length > 0
                  ? newLogs
                  : markerFallbackLogs

            setTestRunSessionId(effectiveResult.runId)
            setTestRunReasonCode(effectiveResult.reasonCode)

            if (effectiveResult.success) {
              setTestRunLogs(scopedLogs)
              setTestRunStatus('SUCCESS')
            } else {
              const classified = classifyRunFailure(effectiveResult)
              const debugSuffix = effectiveResult.debugMessage
                ? ` [debug=${effectiveResult.debugMessage}]`
                : ''
              const logsForModal =
                scopedLogs.length > 0
                  ? scopedLogs
                  : [buildSyntheticDiagnosticLog(effectiveResult, classified.message, attemptId)]

              setTestRunLogs(logsForModal)
              setTestRunStatus(classified.status)
              setTestError(`${classified.message}${debugSuffix} [attempt=${attemptId}]`)
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Nieznany blad testu.'
            setTestRunStatus('ERROR')
            setTestError(message)
          } finally {
            setIsTestRunning(false)
            void loadRecentLogs().catch(() => {
              setTestError((previous) => previous ?? 'Nie udalo sie odswiezyc logow po tescie.')
            })
          }
        }}
        onClose={() => {
          if (isTestRunning) return
          setIsTestModalOpen(false)
        }}
        onStop={async () => {
          const attemptId = globalThis.crypto.randomUUID()
          const stopResult = await stopTestRunMacro({ attemptId })

          if (stopResult.success || stopResult.reasonCode === 'ABORTED') {
            return
          }

          const classified = classifyRunFailure(stopResult)
          setTestError(`${classified.message} [attempt=${attemptId}]`)
        }}
      />
    </section>
  )
}

export default EditorScreen
