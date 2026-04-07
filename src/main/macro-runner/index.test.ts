import { describe, expect, it } from 'vitest'
import { macroRunner } from './index'

describe('MacroRunner', () => {
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
