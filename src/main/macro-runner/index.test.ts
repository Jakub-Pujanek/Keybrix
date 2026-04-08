import { describe, expect, it, vi } from 'vitest'
import { MAX_REPEAT_NESTING_DEPTH } from '../../shared/macro-runtime'

const { pressKeyMock, releaseKeyMock, typeMock, setPositionMock, clickMock } = vi.hoisted(() => ({
  pressKeyMock: vi.fn(async () => undefined),
  releaseKeyMock: vi.fn(async () => undefined),
  typeMock: vi.fn(async () => undefined),
  setPositionMock: vi.fn(async () => undefined),
  clickMock: vi.fn(async () => undefined)
}))

vi.mock('@nut-tree-fork/nut-js', () => ({
  keyboard: {
    pressKey: pressKeyMock,
    releaseKey: releaseKeyMock,
    type: typeMock
  },
  mouse: {
    setPosition: setPositionMock,
    click: clickMock
  },
  Button: {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    MIDDLE: 'MIDDLE'
  },
  Key: {
    LeftControl: 'LeftControl',
    A: 'A',
    Enter: 'Enter'
  },
  Point: class Point {
    constructor(
      public x: number,
      public y: number
    ) {
      void x
      void y
    }
  }
}))
import { macroRunner } from './index'

describe('MacroRunner', () => {
  it('treats malformed blocksJson as no-op run and succeeds', async () => {
    const logs: string[] = []

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-malformed',
        name: 'Malformed',
        shortcut: 'CTRL+M',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          nodes: 'invalid-structure' as unknown as []
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: ({ message }) => {
        logs.push(message)
      },
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(logs.some((entry) => entry.includes('Manual run started'))).toBe(true)
    expect(logs.some((entry) => entry.includes('Manual run finished'))).toBe(true)
  })

  it('executes PRESS_KEY, TYPE_TEXT, MOUSE_CLICK and REPEAT commands', async () => {
    const logs: string[] = []

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-commands',
        name: 'Command Macro',
        shortcut: 'CTRL+A',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            { type: 'PRESS_KEY', payload: { key: 'CTRL+A' } },
            { type: 'TYPE_TEXT', payload: { text: 'hello' } },
            { type: 'MOUSE_CLICK', payload: { x: 100, y: 50, button: 'LEFT' } },
            {
              type: 'REPEAT',
              payload: {
                count: 2,
                commands: [{ type: 'TYPE_TEXT', payload: { text: 'x' } }]
              }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: ({ message }) => {
        logs.push(message)
      },
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(pressKeyMock).toHaveBeenCalled()
    expect(releaseKeyMock).toHaveBeenCalled()
    expect(typeMock).toHaveBeenCalledWith('hello')
    expect(typeMock).toHaveBeenCalledWith('x')
    expect(setPositionMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(logs.some((entry) => entry.includes('Manual run finished'))).toBe(true)
  })

  it('fails when graph compile reports missing START', async () => {
    const logs: string[] = []

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-1',
        name: 'Broken Macro',
        shortcut: 'CTRL+1',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          nodes: [
            {
              id: 'n1',
              type: 'TYPE_TEXT',
              x: 0,
              y: 0,
              nextId: null,
              payload: { text: 'hello' }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: ({ message }) => {
        logs.push(message)
      },
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(false)
    expect(logs.some((entry) => entry.includes('compile errors'))).toBe(true)
  })

  it('fails when nested REPEAT depth exceeds maximum', async () => {
    const logs: string[] = []

    const makeNestedRepeat = (
      depth: number
    ): { type: 'REPEAT'; payload: Record<string, unknown> } => {
      if (depth <= 0) {
        return {
          type: 'REPEAT',
          payload: {
            count: 1,
            commands: [{ type: 'TYPE_TEXT', payload: { text: 'done' } }]
          }
        }
      }

      return {
        type: 'REPEAT',
        payload: {
          count: 1,
          commands: [makeNestedRepeat(depth - 1)]
        }
      }
    }

    const depth = MAX_REPEAT_NESTING_DEPTH + 1
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-too-deep',
        name: 'Too Deep',
        shortcut: 'CTRL+D',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [makeNestedRepeat(depth)]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: ({ message }) => {
        logs.push(message)
      },
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(false)
    expect(logs.some((entry) => entry.includes('max nested REPEAT depth'))).toBe(true)
  })

  it('prefers commands over invalid nodes when both are present', async () => {
    const logs: string[] = []

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-commands-priority',
        name: 'Commands Priority',
        shortcut: 'CTRL+P',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'TYPE_TEXT', payload: { text: 'commands-first' } }],
          nodes: [
            {
              id: 'bad-node',
              type: 'TYPE_TEXT',
              x: 0,
              y: 0,
              nextId: null,
              payload: { text: 'nodes-fallback' }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: ({ message }) => {
        logs.push(message)
      },
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(typeMock).toHaveBeenCalledWith('commands-first')
    expect(logs.some((entry) => entry.includes('compile errors'))).toBe(false)
  })
})
