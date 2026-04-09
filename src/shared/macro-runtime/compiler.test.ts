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

  it('normalizes payloads for new block types and single-key press', () => {
    const commands = compileNodesToRuntimeCommands([
      {
        id: 's1',
        type: 'START',
        x: 0,
        y: 0,
        nextId: 'p1',
        payload: { shortcut: 'CTRL + SHIFT + M' }
      },
      {
        id: 'p1',
        type: 'PRESS_KEY',
        x: 0,
        y: 0,
        nextId: 'h1',
        payload: { key: 'CTRL + C' }
      },
      {
        id: 'h1',
        type: 'HOLD_KEY',
        x: 0,
        y: 0,
        nextId: 'e1',
        payload: { value: 'ALT + X', durationMs: 0 }
      },
      {
        id: 'e1',
        type: 'EXECUTE_SHORTCUT',
        x: 0,
        y: 0,
        nextId: 'a1',
        payload: { value: 'CTRL + ALT + T' }
      },
      {
        id: 'a1',
        type: 'AUTOCLICKER_TIMED',
        x: 0,
        y: 0,
        nextId: 'a2',
        payload: { frequencyMs: 0, durationMs: 0, button: 'RIGHT' }
      },
      {
        id: 'a2',
        type: 'AUTOCLICKER_INFINITE',
        x: 0,
        y: 0,
        nextId: 'm1',
        payload: { frequencyMs: -5 }
      },
      {
        id: 'm1',
        type: 'MOVE_MOUSE_DURATION',
        x: 0,
        y: 0,
        nextId: null,
        payload: { x: 10, y: 20, durationMs: 0 }
      }
    ])

    expect(commands[1]).toEqual({ type: 'PRESS_KEY', payload: { key: 'C' } })
    expect(commands[2]).toEqual({ type: 'HOLD_KEY', payload: { key: 'X', durationMs: 1 } })
    expect(commands[3]).toEqual({ type: 'EXECUTE_SHORTCUT', payload: { shortcut: 'CTRL + ALT + T' } })
    expect(commands[4]).toEqual({
      type: 'AUTOCLICKER_TIMED',
      payload: { button: 'RIGHT', frequencyMs: 1, durationMs: 1 }
    })
    expect(commands[5]).toEqual({
      type: 'AUTOCLICKER_INFINITE',
      payload: { frequencyMs: 1 }
    })
    expect(commands[6]).toEqual({
      type: 'MOVE_MOUSE_DURATION',
      payload: { x: 10, y: 20, durationMs: 1 }
    })
  })
})
