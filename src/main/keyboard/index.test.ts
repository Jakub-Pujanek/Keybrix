import { describe, expect, it, vi } from 'vitest'
import { ShortcutManager } from './index'

type RegistryState = {
  callbacks: Map<string, () => void>
}

const createRegistry = (): {
  state: RegistryState
  registry: {
    register: (shortcut: string, callback: () => void) => boolean
    unregister: (shortcut: string) => void
    unregisterAll: () => void
    isRegistered: (shortcut: string) => boolean
  }
} => {
  const state: RegistryState = {
    callbacks: new Map()
  }

  return {
    state,
    registry: {
      register: (shortcut, callback) => {
        if (state.callbacks.has(shortcut)) return false
        state.callbacks.set(shortcut, callback)
        return true
      },
      unregister: (shortcut) => {
        state.callbacks.delete(shortcut)
      },
      unregisterAll: () => {
        state.callbacks.clear()
      },
      isRegistered: (shortcut) => state.callbacks.has(shortcut)
    }
  }
}

describe('ShortcutManager', () => {
  it('registers and unregisters shortcut by macro id', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    const registered = manager.registerMacro({
      macroId: 'm1',
      shortcut: 'CTRL + A',
      onTrigger: vi.fn()
    })

    expect(registered).toBe(true)
    expect(state.callbacks.has('CTRL+A')).toBe(true)

    manager.unregisterByMacroId('m1')
    expect(state.callbacks.has('CTRL+A')).toBe(false)
  })

  it('rejects collision for different macro ids', () => {
    const { registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    expect(
      manager.registerMacro({
        macroId: 'm1',
        shortcut: 'CTRL+A',
        onTrigger: vi.fn()
      })
    ).toBe(true)

    expect(
      manager.registerMacro({
        macroId: 'm2',
        shortcut: 'CTRL + A',
        onTrigger: vi.fn()
      })
    ).toBe(false)
  })

  it('re-registers shortcut when same macro changes binding', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    expect(
      manager.registerMacro({
        macroId: 'm1',
        shortcut: 'CTRL+A',
        onTrigger: vi.fn()
      })
    ).toBe(true)

    expect(
      manager.registerMacro({
        macroId: 'm1',
        shortcut: 'CTRL+B',
        onTrigger: vi.fn()
      })
    ).toBe(true)

    expect(state.callbacks.has('CTRL+A')).toBe(false)
    expect(state.callbacks.has('CTRL+B')).toBe(true)
  })

  it('cleans all shortcuts on dispose', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    manager.registerMacro({
      macroId: 'm1',
      shortcut: 'CTRL+A',
      onTrigger: vi.fn()
    })
    manager.registerMacro({
      macroId: 'm2',
      shortcut: 'CTRL+B',
      onTrigger: vi.fn()
    })

    manager.dispose()
    expect(state.callbacks.size).toBe(0)
  })
})
