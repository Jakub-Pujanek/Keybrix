import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_REPEAT_NESTING_DEPTH } from '../../shared/macro-runtime'

const {
  pressKeyMock,
  releaseKeyMock,
  typeMock,
  setPositionMock,
  getPositionMock,
  moveMock,
  straightToMock,
  clickMock
} = vi.hoisted(() => ({
  pressKeyMock: vi.fn(async () => undefined),
  releaseKeyMock: vi.fn(async () => undefined),
  typeMock: vi.fn(async () => undefined),
  setPositionMock: vi.fn(async () => undefined),
  getPositionMock: vi.fn(async () => ({ x: 0, y: 0 })),
  moveMock: vi.fn(async () => undefined),
  straightToMock: vi.fn(async (target: { x: number; y: number }) => [target]),
  clickMock: vi.fn(async () => undefined)
}))

const keyboardConfig = vi.hoisted(() => ({
  autoDelayMs: 300
}))

const buttonValues = vi.hoisted(() => ({
  LEFT: 0,
  RIGHT: 1,
  MIDDLE: 2
}))

vi.mock('@nut-tree-fork/nut-js', () => ({
  keyboard: {
    config: keyboardConfig,
    pressKey: pressKeyMock,
    releaseKey: releaseKeyMock,
    type: typeMock
  },
  mouse: {
    config: {
      autoDelayMs: 200,
      mouseSpeed: 1000
    },
    setPosition: setPositionMock,
    getPosition: getPositionMock,
    move: moveMock,
    click: clickMock
  },
  straightTo: straightToMock,
  Button: buttonValues,
  Key: {
    LeftControl: 'LeftControl',
    LeftShift: 'LeftShift',
    LeftAlt: 'LeftAlt',
    LeftSuper: 'LeftSuper',
    A: 'A',
    C: 'C',
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
  beforeEach(() => {
    pressKeyMock.mockClear()
    releaseKeyMock.mockClear()
    typeMock.mockClear()
    setPositionMock.mockClear()
    getPositionMock.mockClear()
    getPositionMock.mockResolvedValue({ x: 0, y: 0 })
    moveMock.mockClear()
    straightToMock.mockClear()
    clickMock.mockClear()
  })

  it('forces keyboard auto delay to zero for low-latency command transitions', async () => {
    expect(keyboardConfig.autoDelayMs).toBe(0)
  })

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
            { type: 'PRESS_KEY', payload: { key: 'A' } },
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

  it('fails MOUSE_CLICK with non-finite coordinates', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-invalid-mouse-click',
        name: 'Invalid Mouse Click',
        shortcut: 'CTRL+X',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'MOUSE_CLICK', payload: { x: Number.NaN, y: 10, button: 'LEFT' } }]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(false)
    expect(setPositionMock).not.toHaveBeenCalled()
    expect(clickMock).not.toHaveBeenCalled()
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

  it('executes HOLD_KEY, EXECUTE_SHORTCUT, AUTOCLICKER_TIMED and MOVE_MOUSE_DURATION commands', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-new-commands',
        name: 'New Commands',
        shortcut: 'CTRL+N',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            { type: 'HOLD_KEY', payload: { key: 'A', durationMs: 1 } },
            { type: 'EXECUTE_SHORTCUT', payload: { shortcut: 'CTRL+ENTER' } },
            {
              type: 'AUTOCLICKER_TIMED',
              payload: { button: 'LEFT', frequencyMs: 1, durationMs: 3 }
            },
            { type: 'MOVE_MOUSE_DURATION', payload: { x: 20, y: 10, durationMs: 1 } }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(pressKeyMock).toHaveBeenCalled()
    expect(releaseKeyMock).toHaveBeenCalled()
    expect(clickMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(moveMock).toHaveBeenCalled()
  })

  it('applies safe fallback payload values for AUTOCLICKER_TIMED and MOVE_MOUSE_DURATION', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-mouse-fallbacks',
        name: 'Mouse Fallbacks',
        shortcut: 'CTRL+F',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            {
              type: 'AUTOCLICKER_TIMED',
              payload: {
                button: 'LEFT',
                durationMs: 1
              }
            },
            {
              type: 'MOVE_MOUSE_DURATION',
              payload: {
                x: 20.6,
                y: 10.4
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
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(clickMock).toHaveBeenCalledTimes(1)
    expect(moveMock).toHaveBeenCalledTimes(1)
    expect(straightToMock).toHaveBeenCalledTimes(1)

    const targetPoint = straightToMock.mock.calls[0]?.[0] as { x: number; y: number }
    expect(targetPoint.x).toBe(21)
    expect(targetPoint.y).toBe(10)
  })

  it('uses fallback frequency for AUTOCLICKER_INFINITE and stops on abort', async () => {
    let checks = 0

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-infinite-fallback',
        name: 'Infinite Fallback',
        shortcut: 'CTRL+G',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            {
              type: 'AUTOCLICKER_INFINITE',
              payload: {
                button: 'RIGHT'
              }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: false
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true,
      shouldAbort: () => {
        checks += 1
        return checks >= 3
      }
    })

    expect(result.success).toBe(true)
    expect(clickMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(clickMock).toHaveBeenCalledWith(buttonValues.RIGHT)
  })

  it('stops AUTOCLICKER_INFINITE when global master is disabled', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-autoclicker-infinite',
        name: 'Autoclicker Infinite',
        shortcut: 'CTRL+I',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'AUTOCLICKER_INFINITE', payload: { button: 'LEFT', frequencyMs: 1 } }]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: false
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => false
    })

    expect(result.success).toBe(false)
  })

  it('returns COMMAND_ERROR with contextual log when MOUSE_CLICK click operation fails', async () => {
    const logs: string[] = []
    clickMock.mockRejectedValueOnce(new Error('native click failed'))

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-mouse-click-fail',
        name: 'Mouse Click Fail',
        shortcut: 'CTRL+M',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'MOUSE_CLICK', payload: { x: 15, y: 25, button: 'LEFT' } }]
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
    expect(result.reasonCode).toBe('COMMAND_ERROR')
    expect(
      logs.some((entry) =>
        entry.includes("MOUSE_CLICK click with button 'LEFT' failed: native click failed")
      )
    ).toBe(true)
  })

  it('returns COMMAND_TIMEOUT when AUTOCLICKER_TIMED click reports timeout', async () => {
    clickMock.mockRejectedValueOnce(
      new Error("AUTOCLICKER_TIMED timed out after 2000ms while clicking 'LEFT'.")
    )

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-autoclicker-timed-timeout',
        name: 'Autoclicker Timed Timeout',
        shortcut: 'CTRL+T',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            {
              type: 'AUTOCLICKER_TIMED',
              payload: { button: 'LEFT', frequencyMs: 1, durationMs: 5 }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('COMMAND_TIMEOUT')
  })

  it('aborts WAIT command in the middle of delay window', async () => {
    vi.useFakeTimers()
    const logs: string[] = []
    let shouldAbort = false

    const runPromise = macroRunner.runMacro({
      macro: {
        id: 'macro-wait-abort-mid-command',
        name: 'Wait Abort Mid Command',
        shortcut: 'CTRL+W',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'WAIT', payload: { durationMs: 1000 } }]
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
      isGlobalMasterEnabled: () => true,
      shouldAbort: () => shouldAbort
    })

    await vi.advanceTimersByTimeAsync(35)
    shouldAbort = true
    await vi.advanceTimersByTimeAsync(50)

    const result = await runPromise
    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('ABORTED')
    expect(logs.some((entry) => entry.includes('Wait interrupted'))).toBe(true)

    vi.useRealTimers()
  })

  it('aborts HOLD_KEY mid-duration and still releases the key', async () => {
    vi.useFakeTimers()
    let shouldAbort = false

    const runPromise = macroRunner.runMacro({
      macro: {
        id: 'macro-hold-abort-mid-command',
        name: 'Hold Abort Mid Command',
        shortcut: 'CTRL+H',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'HOLD_KEY', payload: { key: 'A', durationMs: 1000 } }]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true,
      shouldAbort: () => shouldAbort
    })

    await vi.advanceTimersByTimeAsync(35)
    shouldAbort = true
    await vi.advanceTimersByTimeAsync(50)

    const result = await runPromise
    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('ABORTED')
    expect(pressKeyMock).toHaveBeenCalled()
    expect(releaseKeyMock).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('accepts quoted button label in legacy mouse payloads', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-quoted-button',
        name: 'Quoted Button',
        shortcut: 'CTRL+Q',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [{ type: 'MOUSE_CLICK', payload: { x: 30, y: 40, button: "'LEFT'" } }]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: true
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true
    })

    expect(result.success).toBe(true)
    expect(clickMock).toHaveBeenCalledWith(buttonValues.LEFT)
  })

  it('runs INFINITE_LOOP nested commands until abort signal', async () => {
    let checks = 0

    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-infinite-loop',
        name: 'Infinite Loop',
        shortcut: 'CTRL+L',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            {
              type: 'INFINITE_LOOP',
              payload: {
                commands: [{ type: 'TYPE_TEXT', payload: { text: 'tick' } }]
              }
            }
          ]
        }
      },
      settings: {
        globalMaster: true,
        delayMs: 0,
        stopOnError: false
      },
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true,
      shouldAbort: () => {
        checks += 1
        return checks >= 8
      }
    })

    expect(result.success).toBe(false)
    expect(result.reasonCode).toBe('ABORTED')
    expect(
      typeMock.mock.calls.filter((call) => call.at(0) === 'tick').length
    ).toBeGreaterThanOrEqual(1)
  })

  it('fails INFINITE_LOOP when nested command fails and stopOnError is enabled', async () => {
    const result = await macroRunner.runMacro({
      macro: {
        id: 'macro-infinite-loop-stop-on-error',
        name: 'Infinite Loop Stop On Error',
        shortcut: 'CTRL+E',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {
          commands: [
            {
              type: 'INFINITE_LOOP',
              payload: {
                commands: [{ type: 'HOLD_KEY', payload: {} }]
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
      onLog: () => undefined,
      isGlobalMasterEnabled: () => true,
      shouldAbort: () => false
    })

    expect(result.success).toBe(false)
  })
})
