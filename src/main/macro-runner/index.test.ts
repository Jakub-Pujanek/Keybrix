import { describe, expect, it, vi } from 'vitest'

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
            { type: 'PRESS_KEY', key: 'CTRL+A' },
            { type: 'TYPE_TEXT', text: 'hello' },
            { type: 'MOUSE_CLICK', payload: { x: 100, y: 50, button: 'LEFT' } },
            {
              type: 'REPEAT',
              payload: {
                count: 2,
                commands: [{ type: 'TYPE_TEXT', text: 'x' }]
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

  it('returns failure when command type is missing and stopOnError is enabled', async () => {
    const logs: string[] = []

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-1',
        name: 'Broken Macro',
        shortcut: 'CTRL+1',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ invalid: true }]
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
    expect(logs.some((entry) => entry.includes('failed on command'))).toBe(true)
  })
})
