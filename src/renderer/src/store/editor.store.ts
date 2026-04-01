import { create } from 'zustand'
import {
  EditorDocumentSchema,
  EditorNodeSchema,
  type EditorBlockType,
  type EditorNode,
  type Macro
} from '../../../shared/api'

type RecordingSource = 'topbar' | 'start-block' | 'press-key-block'

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
  testRunMacro: () => Promise<void>
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
      key: 'CTRL + C'
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
      label: 'MOUSE CLICK',
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

const formatShortcut = (codes: string[]): string => {
  const normalized = codes.map((code) => normalizeKey(code))
  return normalized.join(' + ')
}

const firstMacro = async (): Promise<Macro | null> => {
  const all = await window.api.macros.getAll()
  return all.length > 0 ? all[0] : null
}

const normalizeLoadedNodes = (nodes: EditorNode[]): EditorNode[] => {
  return nodes.map((node) => {
    if (node.type === 'START') {
      return {
        ...node,
        payload: {
          ...node.payload,
          label: 'Start'
        }
      }
    }

    if (node.type === 'PRESS_KEY' && node.payload.value && !node.payload.key) {
      return {
        ...node,
        payload: {
          ...node.payload,
          key: node.payload.value
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

    return node
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
  nodes: defaultNodes,
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

    const loadedNodes = parsedNodes.success
      ? normalizeLoadedNodes(parsedNodes.data.nodes)
      : defaultNodes

    set({
      activeMacroId: selected.id,
      macroTitle: selected.name,
      shortcut: selected.shortcut.replace(/\+/g, ' + '),
      nodes: loadedNodes,
      zoom: parsedNodes.success ? parsedNodes.data.zoom : 1
    })
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
        label: type.replace('_', ' ')
      }
    })

    if (type === 'PRESS_KEY') {
      nextNode.payload.key = 'A'
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
    if (type === 'REPEAT') {
      nextNode.payload.count = 2
    }
    if (type === 'INFINITE_LOOP') {
      nextNode.payload.label = 'Infinite Loop'
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
    set({ nodes: defaultNodes })
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
    const nextCombo = comboKeys.includes(event.code) ? comboKeys : [...comboKeys, event.code]

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

    set((state) => {
      if (recordingSource === 'press-key-block' && recordingNodeId) {
        return {
          isRecordingShortcut: false,
          recordingSource: null,
          recordingNodeId: null,
          comboKeys: [],
          nodes: state.nodes.map((node) =>
            node.id === recordingNodeId && node.type === 'PRESS_KEY'
              ? {
                  ...node,
                  payload: {
                    ...node.payload,
                    key: formatted
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
        keys: formatted,
        source: recordingSource
      })
    }
  },

  saveMacroFromEditor: async () => {
    const { activeMacroId, macroTitle, shortcut, nodes, zoom } = get()
    const orderedNodes = orderNodesByConnections(nodes)

    const saved = await window.api.macros.save({
      id: activeMacroId ?? undefined,
      name: macroTitle,
      shortcut: shortcut.replace(/\s\+\s/g, '+'),
      isActive: true,
      status: 'ACTIVE',
      blocksJson: {
        nodes: orderedNodes,
        zoom
      }
    })

    set({ activeMacroId: saved.id })
    return true
  },

  testRunMacro: async () => {
    const { activeMacroId } = get()
    if (!activeMacroId) return

    await window.api.macros.runManually(activeMacroId)
  }
}))
