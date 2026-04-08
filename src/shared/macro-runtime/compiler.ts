import {
  EditorNodeSchema,
  RuntimeCommandSchema,
  type EditorNode,
  type RuntimeCommand
} from '../api'
import { MAX_REPEAT_ITERATIONS, MAX_REPEAT_NESTED_COMMANDS } from './constants'

export const RuntimeCompileDiagnosticSeverity = {
  ERROR: 'ERROR',
  WARN: 'WARN'
} as const

export type RuntimeCompileDiagnosticSeverity =
  (typeof RuntimeCompileDiagnosticSeverity)[keyof typeof RuntimeCompileDiagnosticSeverity]

export const RuntimeCompileDiagnosticCode = {
  MISSING_START: 'MISSING_START',
  MULTIPLE_START: 'MULTIPLE_START',
  BROKEN_LINK: 'BROKEN_LINK',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  UNREACHABLE_NODE: 'UNREACHABLE_NODE'
} as const

export type RuntimeCompileDiagnosticCode =
  (typeof RuntimeCompileDiagnosticCode)[keyof typeof RuntimeCompileDiagnosticCode]

export type RuntimeCompileDiagnostic = {
  severity: RuntimeCompileDiagnosticSeverity
  code: RuntimeCompileDiagnosticCode
  message: string
  nodeId?: string
}

export type RuntimeCompileResult = {
  commands: RuntimeCommand[]
  diagnostics: RuntimeCompileDiagnostic[]
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

const normalizeCommandPayload = (node: EditorNode): Record<string, unknown> => {
  const payload = asRecord(node.payload)

  if (node.type === 'PRESS_KEY') {
    const keyCandidate = payload['key'] ?? payload['keys'] ?? payload['value']
    return typeof keyCandidate === 'string' ? { key: keyCandidate } : {}
  }

  if (node.type === 'TYPE_TEXT') {
    const textCandidate = payload['text'] ?? payload['value']
    return typeof textCandidate === 'string' ? { text: textCandidate } : { text: '' }
  }

  if (node.type === 'WAIT') {
    const durationMs = payload['durationMs']
    return typeof durationMs === 'number' ? { durationMs } : { durationMs: 0 }
  }

  if (node.type === 'MOUSE_CLICK') {
    const x = payload['x']
    const y = payload['y']
    const button = payload['button']

    const next: Record<string, unknown> = {}
    if (typeof x === 'number') next['x'] = x
    if (typeof y === 'number') next['y'] = y
    if (button === 'LEFT' || button === 'RIGHT' || button === 'MIDDLE') {
      next['button'] = button
    }
    return next
  }

  if (node.type === 'REPEAT') {
    const count = payload['count']
    const rawCommands = payload['commands']

    const commands = Array.isArray(rawCommands)
      ? rawCommands
          .map((item) => RuntimeCommandSchema.safeParse(item))
          .filter((item): item is { success: true; data: RuntimeCommand } => item.success)
          .map((item) => item.data)
          .slice(0, MAX_REPEAT_NESTED_COMMANDS)
      : []

    return {
      count:
        typeof count === 'number'
          ? Math.max(1, Math.min(MAX_REPEAT_ITERATIONS, Math.floor(count)))
          : 1,
      commands
    }
  }

  if (node.type === 'START') {
    const shortcut = payload['shortcut']
    return typeof shortcut === 'string' ? { shortcut } : {}
  }

  return {}
}

const orderNodesByConnections = (
  nodes: EditorNode[]
): { orderedNodes: EditorNode[]; diagnostics: RuntimeCompileDiagnostic[] } => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ordered: EditorNode[] = []
  const visited = new Set<string>()
  const diagnostics: RuntimeCompileDiagnostic[] = []

  const walk = (startId: string): void => {
    let cursor = byId.get(startId)
    const chainVisited = new Set<string>()

    while (cursor && !visited.has(cursor.id)) {
      ordered.push(cursor)
      visited.add(cursor.id)
      chainVisited.add(cursor.id)

      if (!cursor.nextId) {
        cursor = undefined
        continue
      }

      if (chainVisited.has(cursor.nextId)) {
        diagnostics.push({
          severity: RuntimeCompileDiagnosticSeverity.ERROR,
          code: RuntimeCompileDiagnosticCode.CYCLE_DETECTED,
          message: `Cycle detected from node '${cursor.id}' to '${cursor.nextId}'.`,
          nodeId: cursor.id
        })
        break
      }

      const next = byId.get(cursor.nextId)
      if (!next) {
        diagnostics.push({
          severity: RuntimeCompileDiagnosticSeverity.ERROR,
          code: RuntimeCompileDiagnosticCode.BROKEN_LINK,
          message: `Node '${cursor.id}' points to missing next node '${cursor.nextId}'.`,
          nodeId: cursor.id
        })
        break
      }

      cursor = next
    }
  }

  const startNodes = nodes.filter((node) => node.type === 'START')
  if (startNodes.length === 0) {
    diagnostics.push({
      severity: RuntimeCompileDiagnosticSeverity.ERROR,
      code: RuntimeCompileDiagnosticCode.MISSING_START,
      message: 'Editor graph is missing START block.'
    })
  }

  if (startNodes.length > 1) {
    diagnostics.push({
      severity: RuntimeCompileDiagnosticSeverity.WARN,
      code: RuntimeCompileDiagnosticCode.MULTIPLE_START,
      message: `Editor graph has ${startNodes.length} START blocks. Using first in traversal.`
    })
  }

  const startNode = startNodes[0]
  if (startNode) {
    walk(startNode.id)
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node)
      visited.add(node.id)
      diagnostics.push({
        severity: RuntimeCompileDiagnosticSeverity.WARN,
        code: RuntimeCompileDiagnosticCode.UNREACHABLE_NODE,
        message: `Node '${node.id}' is not reachable from START and was appended.`,
        nodeId: node.id
      })
    }
  }

  return { orderedNodes: ordered, diagnostics }
}

export const compileNodesToRuntime = (nodes: unknown): RuntimeCompileResult => {
  if (!Array.isArray(nodes)) {
    return {
      commands: [],
      diagnostics: []
    }
  }

  const parsedNodes = nodes
    .map((node) => EditorNodeSchema.safeParse(node))
    .filter((item): item is { success: true; data: EditorNode } => item.success)
    .map((item) => item.data)

  const { orderedNodes, diagnostics } = orderNodesByConnections(parsedNodes)

  return {
    commands: orderedNodes.map((node) =>
      RuntimeCommandSchema.parse({
        type: node.type,
        payload: normalizeCommandPayload(node)
      })
    ),
    diagnostics
  }
}

export const compileNodesToRuntimeCommands = (nodes: unknown): RuntimeCommand[] => {
  return compileNodesToRuntime(nodes).commands
}
