import { describe, expect, it } from 'vitest'
import { MAX_REPEAT_NESTED_COMMANDS } from './constants'
import {
  RuntimeCompileDiagnosticCode,
  RuntimeCompileDiagnosticSeverity,
  compileNodesToRuntime,
  compileNodesToRuntimeCommands
} from './compiler'

describe('compileNodesToRuntimeCommands', () => {
  it('orders nodes by nextId chain starting from START', () => {
    const commands = compileNodesToRuntimeCommands([
      {
        id: 'n2',
        type: 'TYPE_TEXT',
        x: 0,
        y: 0,
        nextId: null,
        payload: { text: 'hello' }
      },
      {
        id: 'n1',
        type: 'START',
        x: 0,
        y: 0,
        nextId: 'n2',
        payload: { shortcut: 'CTRL+SHIFT+M' }
      }
    ])

    expect(commands).toHaveLength(2)
    expect(commands[0]?.type).toBe('START')
    expect(commands[1]?.type).toBe('TYPE_TEXT')
  })

  it('normalizes REPEAT payload to include commands array', () => {
    const commands = compileNodesToRuntimeCommands([
      {
        id: 'r1',
        type: 'REPEAT',
        x: 0,
        y: 0,
        nextId: null,
        payload: { count: 3 }
      }
    ])

    expect(commands).toHaveLength(1)
    expect(commands[0]?.type).toBe('REPEAT')
    expect(commands[0]?.payload).toEqual({ count: 3, commands: [] })
  })

  it('reports error when START block is missing', () => {
    const result = compileNodesToRuntime([
      {
        id: 'n1',
        type: 'TYPE_TEXT',
        x: 0,
        y: 0,
        nextId: null,
        payload: { text: 'hello' }
      }
    ])

    expect(result.commands).toHaveLength(1)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: RuntimeCompileDiagnosticSeverity.ERROR,
          code: RuntimeCompileDiagnosticCode.MISSING_START
        })
      ])
    )
  })

  it('caps REPEAT nested commands to shared max limit', () => {
    const nested = Array.from({ length: MAX_REPEAT_NESTED_COMMANDS + 25 }, () => ({
      type: 'TYPE_TEXT',
      payload: { text: 'x' }
    }))

    const commands = compileNodesToRuntimeCommands([
      {
        id: 's1',
        type: 'START',
        x: 0,
        y: 0,
        nextId: 'r1',
        payload: {}
      },
      {
        id: 'r1',
        type: 'REPEAT',
        x: 0,
        y: 0,
        nextId: null,
        payload: { count: 2, commands: nested }
      }
    ])

    expect(commands[1]?.type).toBe('REPEAT')
    const payload = commands[1]?.payload as { commands?: unknown[] }
    expect(payload.commands).toHaveLength(MAX_REPEAT_NESTED_COMMANDS)
  })
})
