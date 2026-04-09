import { create } from 'zustand'
import {
  EditorDocumentSchema,
  EditorNodeSchema,
  type EditorBlockType,
  type EditorNode,
  type ManualRunResult,
  type Macro
} from '../../../shared/api'
import { compileNodesToRuntimeCommands } from '../../../shared/macro-runtime'

type RecordingSource = 'topbar' | 'start-block' | 'press-key-block' | 'execute-shortcut-block'

type EditorState = {
  nodes: EditorNode[]
  zoom: number
  activeMacroId: string | null
  macroTitle: string
  shortcut: string
  isRecordingShortcut: boolean
  recordingSource: RecordingSource | null
  recordingNodeId: string | null
  heldKeys: string[]
  comboKeys: string[]
  loadEditorMacro: (macroId?: string) => Promise<void>
  setMacroTitle: (nextTitle: string) => void
  addNode: (type: EditorBlockType, position?: { x: number; y: number }) => void
  setNodePosition: (nodeId: string, x: number, y: number) => void
  setManyNodePositions: (updates: Array<{ id: string; x: number; y: number }>) => void
  setNodeNext: (nodeId: string, nextId: string | null) => void
  clearIncomingConnection: (nodeId: string) => void
  removeNodeTree: (rootId: string) => void
  updateNodePayload: (nodeId: string, nextPayload: Record<string, unknown>) => void
  clearNodes: () => void
  setZoom: (zoom: number) => void
  startShortcutRecording: (source: RecordingSource, nodeId?: string) => void
  cancelShortcutRecording: () => void
  handleShortcutKeyDown: (event: KeyboardEvent) => void
  handleShortcutKeyUp: (event: KeyboardEvent) => Promise<void>
  saveMacroFromEditor: () => Promise<boolean>
  testRunMacro: (context?: { attemptId?: string }) => Promise<ManualRunResult>
}

const blockTitleByType: Record<EditorBlockType, string> = {
  START: 'Start',
  PRESS_KEY: 'Press Key',
  HOLD_KEY: 'Hold Key',
  EXECUTE_SHORTCUT: 'Execute Shortcut',
  WAIT: 'Wait',
  MOUSE_CLICK: 'Mouse Click',
  AUTOCLICKER_TIMED: 'Autoclicker Timed',
  AUTOCLICKER_INFINITE: 'Autoclicker Infinite',
  MOVE_MOUSE_DURATION: 'Move Mouse',
  TYPE_TEXT: 'Type Text',
  REPEAT: 'Repeat',
  INFINITE_LOOP: 'Infinite Loop'
}

const defaultNodes: EditorNode[] = [
  {
    id: 'node-start',
    type: 'START',
    x: 220,
    y: 72,
    nextId: 'node-press-key',
    payload: {
      label: 'Start',
      shortcut: 'CTRL + SHIFT + M'
    }
  },
  {
    id: 'node-press-key',
    type: 'PRESS_KEY',
    x: 220,
    y: 141,
    nextId: 'node-wait',
    payload: {
      label: 'Press Key',
      key: 'C'
    }
  },
  {
    id: 'node-wait',
    type: 'WAIT',
    x: 220,
    y: 244,
    nextId: 'node-click',
    payload: {
      label: 'Wait',
      durationMs: 300
    }
  },
  {
    id: 'node-click',
    type: 'MOUSE_CLICK',
    x: 220,
    y: 347,
    nextId: 'node-type',
    payload: {
      label: 'Mouse Click',
      x: 500,
      y: 300,
      button: 'LEFT'
    }
  },
  {
    id: 'node-type',
    type: 'TYPE_TEXT',
    x: 220,
    y: 450,
    nextId: 'node-repeat',
    payload: {
      label: 'Type Text',
      text: 'Hello World'
    }
  },
  {
    id: 'node-repeat',
    type: 'REPEAT',
    x: 220,
    y: 553,
    nextId: null,
    payload: {
      label: 'Repeat',
      count: 3
    }
  }
]

const cloneNodes = (nodes: EditorNode[]): EditorNode[] =>
  nodes.map((node) => ({
    ...node,
    payload: { ...node.payload }
  }))

const normalizeKey = (code: string): string => {
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT'
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'CMD'
  if (code.startsWith('Key')) return code.replace('Key', '').toUpperCase()
  if (code.startsWith('Digit')) return code.replace('Digit', '')
  if (code === 'Space') return 'SPACE'
  return code.toUpperCase()
}

const isModifierCode = (code: string): boolean => {
  return (
    code === 'ControlLeft' ||
    code === 'ControlRight' ||
    code === 'ShiftLeft' ||
    code === 'ShiftRight' ||
    code === 'AltLeft' ||
    code === 'AltRight' ||
    code === 'MetaLeft' ||
    code === 'MetaRight'
  )
}

const formatShortcut = (codes: string[]): string => {
  const normalized = codes.map((code) => normalizeKey(code))
  return normalized.join(' + ')
}

const formatSingleKey = (codes: string[]): string => {
  const nonModifier = codes.filter((code) => !isModifierCode(code))
  const preferred =
    nonModifier.length > 0 ? nonModifier[nonModifier.length - 1] : codes[codes.length - 1]

  return preferred ? normalizeKey(preferred) : ''
}

const firstMacro = async (): Promise<Macro | null> => {
  const all = await window.api.macros.getAll()
  return all.length > 0 ? all[0] : null
}

const normalizeLoadedNodes = (nodes: EditorNode[], macroShortcut: string): EditorNode[] => {
  return nodes.map((node) => {
    const defaultLabel = blockTitleByType[node.type]
    const incomingLabel = typeof node.payload.label === 'string' ? node.payload.label : undefined

    const normalizedLabel =
      !incomingLabel || incomingLabel === node.type.replaceAll('_', ' ')
        ? defaultLabel
        : incomingLabel

    if (node.type === 'START') {
      return {
        ...node,
        payload: {
          ...node.payload,
          label: normalizedLabel,
          shortcut: macroShortcut
        }
      }
    }

    if (node.type === 'PRESS_KEY' && node.payload.value && !node.payload.key) {
      return {
        ...node,
        payload: {
          ...node.payload,
          key: String(node.payload.value)
            .split('+')
            .map((chunk) => chunk.trim())
            .filter((chunk) => chunk.length > 0)
            .at(-1)
        }
      }
    }

    if (node.type === 'EXECUTE_SHORTCUT' && node.payload.value && !node.payload.shortcut) {
      return {
        ...node,
        payload: {
          ...node.payload,
          shortcut: node.payload.value
        }
      }
    }

    if (node.type === 'TYPE_TEXT' && node.payload.value && !node.payload.text) {
      return {
        ...node,
        payload: {
          ...node.payload,
          text: node.payload.value
        }
      }
    }

    return {
      ...node,
      payload: {
        ...node.payload,
        label: normalizedLabel
      }
    }
  })
}

const orderNodesByConnections = (nodes: EditorNode[]): EditorNode[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ordered: EditorNode[] = []
  const visited = new Set<string>()

  const walk = (startId: string): void => {
    let cursor = byId.get(startId)
    while (cursor && !visited.has(cursor.id)) {
      ordered.push(cursor)
      visited.add(cursor.id)
      cursor = cursor.nextId ? byId.get(cursor.nextId) : undefined
    }
  }

  const startNode = nodes.find((node) => node.type === 'START')
  if (startNode) walk(startNode.id)

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node)
    }
  }

  return ordered
}

const collectChainIds = (nodes: EditorNode[], rootId: string): Set<string> => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const chainIds = new Set<string>()

  let cursor = byId.get(rootId)
  while (cursor && !chainIds.has(cursor.id)) {
    chainIds.add(cursor.id)
    cursor = cursor.nextId ? byId.get(cursor.nextId) : undefined
  }

  return chainIds
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: cloneNodes(defaultNodes),
  zoom: 1,
  activeMacroId: null,
  macroTitle: 'My First Macro',
  shortcut: 'CTRL + SHIFT + M',
  isRecordingShortcut: false,
  recordingSource: null,
  recordingNodeId: null,
  heldKeys: [],
  comboKeys: [],

  loadEditorMacro: async (macroId) => {
    const selected = macroId ? await window.api.macros.getById(macroId) : await firstMacro()
    if (!selected) return

    const parsedNodes = EditorDocumentSchema.safeParse(selected.blocksJson)
    const formattedShortcut = selected.shortcut.replace(/\+/g, ' + ')

    const loadedNodes = parsedNodes.success
      ? normalizeLoadedNodes(parsedNodes.data.nodes, formattedShortcut)
      : []

    set({
      activeMacroId: selected.id,
      macroTitle: selected.name,
      shortcut: formattedShortcut,
      nodes: loadedNodes,
      zoom: parsedNodes.success ? parsedNodes.data.zoom : 1
    })
  },

  setMacroTitle: (nextTitle) => {
    set({ macroTitle: nextTitle.slice(0, 60) })
  },

  addNode: (type, position) => {
    const id = `node-${type.toLowerCase()}-${Date.now()}`
    const nextNode = EditorNodeSchema.parse({
      id,
      type,
      x: position?.x ?? 120,
      y: position?.y ?? 120,
      nextId: null,
      payload: {
        label: blockTitleByType[type]
      }
    })

    if (type === 'PRESS_KEY') {
      nextNode.payload.key = 'A'
    }
    if (type === 'HOLD_KEY') {
      nextNode.payload.key = 'A'
      nextNode.payload.durationMs = 300
    }
    if (type === 'EXECUTE_SHORTCUT') {
      nextNode.payload.shortcut = 'CTRL + C'
    }
    if (type === 'TYPE_TEXT') {
      nextNode.payload.text = ''
    }
    if (type === 'WAIT') {
      nextNode.payload.durationMs = 300
    }
    if (type === 'MOUSE_CLICK') {
      nextNode.payload.x = 500
      nextNode.payload.y = 300
      nextNode.payload.button = 'LEFT'
    }
    if (type === 'AUTOCLICKER_TIMED') {
      nextNode.payload.button = 'LEFT'
      nextNode.payload.frequencyMs = 100
      nextNode.payload.durationMs = 1000
    }
    if (type === 'AUTOCLICKER_INFINITE') {
      nextNode.payload.button = 'LEFT'
      nextNode.payload.frequencyMs = 100
    }
    if (type === 'MOVE_MOUSE_DURATION') {
      nextNode.payload.x = 500
      nextNode.payload.y = 300
      nextNode.payload.durationMs = 250
    }
    if (type === 'REPEAT') {
      nextNode.payload.count = 2
    }
    set((state) => ({ nodes: [...state.nodes, nextNode] }))
  },

  setNodePosition: (nodeId, x, y) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
    }))
  },

  setManyNodePositions: (updates) => {
    const updateById = new Map(updates.map((item) => [item.id, item]))

    set((state) => ({
      nodes: state.nodes.map((node) => {
        const next = updateById.get(node.id)
        if (!next) return node

        return {
          ...node,
          x: next.x,
          y: next.y
        }
      })
    }))
  },

  setNodeNext: (nodeId, nextId) => {
    set((state) => {
      const nextNodes = state.nodes.map((node) => {
        if (node.id !== nodeId && node.nextId === nextId && nextId) {
          return { ...node, nextId: null }
        }
        return node
      })

      return {
        nodes: nextNodes.map((node) => (node.id === nodeId ? { ...node, nextId } : node))
      }
    })
  },

  clearIncomingConnection: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (node.nextId === nodeId ? { ...node, nextId: null } : node))
    }))
  },

  removeNodeTree: (rootId) => {
    set((state) => {
      const chainIds = collectChainIds(state.nodes, rootId)

      return {
        nodes: state.nodes
          .filter((node) => !chainIds.has(node.id))
          .map((node) =>
            node.nextId && chainIds.has(node.nextId) ? { ...node, nextId: null } : node
          )
      }
    })
  },

  updateNodePayload: (nodeId, nextPayload) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, payload: { ...node.payload, ...nextPayload } } : node
      )
    }))
  },

  clearNodes: () => {
    set({ nodes: [] })
  },

  setZoom: (zoom) => {
    const clamped = Math.min(2, Math.max(0.5, zoom))
    set({ zoom: clamped })
  },

  startShortcutRecording: (source, nodeId) => {
    set({
      isRecordingShortcut: true,
      recordingSource: source,
      recordingNodeId: nodeId ?? null,
      heldKeys: [],
      comboKeys: []
    })
  },

  cancelShortcutRecording: () => {
    set({
      isRecordingShortcut: false,
      recordingSource: null,
      recordingNodeId: null,
      heldKeys: [],
      comboKeys: []
    })
  },

  handleShortcutKeyDown: (event) => {
    const { isRecordingShortcut, heldKeys, comboKeys } = get()
    if (!isRecordingShortcut) return

    event.preventDefault()

    const nextHeld = heldKeys.includes(event.code) ? heldKeys : [...heldKeys, event.code]
    const nextComboBase = comboKeys.includes(event.code) ? comboKeys : [...comboKeys, event.code]
    const modifiers = nextComboBase.filter((code) => isModifierCode(code))
    const primaries = nextComboBase.filter((code) => !isModifierCode(code))
    const nextCombo =
      primaries.length > 0 ? [...modifiers, primaries[primaries.length - 1]] : modifiers

    set({ heldKeys: nextHeld, comboKeys: nextCombo })
  },

  handleShortcutKeyUp: async (event) => {
    const { isRecordingShortcut, heldKeys, comboKeys, recordingSource, recordingNodeId } = get()
    if (!isRecordingShortcut) return

    event.preventDefault()

    const nextHeld = heldKeys.filter((code) => code !== event.code)
    set({ heldKeys: nextHeld })

    if (nextHeld.length !== 0 || comboKeys.length === 0) return

    const formatted = formatShortcut(comboKeys)
    const singleKey = formatSingleKey(comboKeys)

    set((state) => {
      if (recordingSource === 'press-key-block' && recordingNodeId) {
        return {
          isRecordingShortcut: false,
          recordingSource: null,
          recordingNodeId: null,
          comboKeys: [],
          nodes: state.nodes.map((node) =>
            node.id === recordingNodeId && (node.type === 'PRESS_KEY' || node.type === 'HOLD_KEY')
              ? {
                  ...node,
                  payload: {
                    ...node.payload,
                    key: singleKey || formatted
                  }
                }
              : node
          )
        }
      }
      if (recordingSource === 'execute-shortcut-block' && recordingNodeId) {
        return {
          isRecordingShortcut: false,
          recordingSource: null,
          recordingNodeId: null,
          comboKeys: [],
          nodes: state.nodes.map((node) =>
            node.id === recordingNodeId && node.type === 'EXECUTE_SHORTCUT'
              ? {
                  ...node,
                  payload: {
                    ...node.payload,
                    shortcut: formatted
                  }
                }
              : node
          )
        }
      }

      return {
        shortcut: formatted,
        isRecordingShortcut: false,
        recordingSource: null,
        recordingNodeId: null,
        comboKeys: [],
        nodes: state.nodes.map((node) =>
          node.type === 'START'
            ? {
                ...node,
                payload: {
                  ...node.payload,
                  shortcut: formatted
                }
              }
            : node
        )
      }
    })

    if (recordingSource) {
      await window.api.keyboard.recordShortcut({
        keys: recordingSource === 'press-key-block' ? singleKey || formatted : formatted,
        source: recordingSource
      })
    }
  },

  saveMacroFromEditor: async () => {
    const { activeMacroId, macroTitle, shortcut, nodes, zoom } = get()
    const orderedNodes = orderNodesByConnections(nodes)
    const synchronizedNodes = orderedNodes.map((node) =>
      node.type === 'START'
        ? {
            ...node,
            payload: {
              ...node.payload,
              shortcut
            }
          }
        : node
    )
    const commands = compileNodesToRuntimeCommands(synchronizedNodes)

    const saved = await window.api.macros.save({
      id: activeMacroId ?? undefined,
      name: macroTitle,
      shortcut: shortcut.replace(/\s\+\s/g, '+'),
      isActive: false,
      status: 'IDLE',
      blocksJson: {
        commands,
        nodes: synchronizedNodes,
        zoom
      }
    })

    set({
      activeMacroId: saved.id,
      macroTitle: saved.name,
      shortcut: saved.shortcut.replace(/\+/g, ' + ')
    })
    return true
  },

  testRunMacro: async (context) => {
    let failedStage: 'save' | 'run' = 'save'

    try {
      const saved = await get().saveMacroFromEditor()
      if (!saved) {
        return {
          runId: globalThis.crypto.randomUUID(),
          success: false,
          reasonCode: 'SAVE_FAILED'
        }
      }

      const { activeMacroId } = get()
      if (!activeMacroId) {
        return {
          runId: globalThis.crypto.randomUUID(),
          success: false,
          reasonCode: 'MACRO_NOT_FOUND'
        }
      }

      failedStage = 'run'
      return await window.api.macros.runManually(activeMacroId, {
        attemptId: context?.attemptId
      })
    } catch (error) {
      console.error('[editor.store] testRunMacro failed', {
        stage: failedStage,
        error
      })

      const debugMessage = error instanceof Error ? error.message : 'unknown editor.store failure'

      return {
        runId: globalThis.crypto.randomUUID(),
        success: false,
        reasonCode: failedStage === 'save' ? 'SAVE_FAILED' : 'IPC_ERROR',
        debugMessage
      }
    }
  }
}))
