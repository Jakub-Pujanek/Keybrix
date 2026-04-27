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
    expect(state.callbacks.has('CommandOrControl+A')).toBe(true)

    manager.unregisterByMacroId('m1')
    expect(state.callbacks.has('CommandOrControl+A')).toBe(false)
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

    expect(state.callbacks.has('CommandOrControl+A')).toBe(false)
    expect(state.callbacks.has('CommandOrControl+B')).toBe(true)
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

  it('recovers from stale global registration not tracked in manager maps', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    state.callbacks.set('CommandOrControl+Shift+K', vi.fn())

    const registered = manager.registerMacro({
      macroId: 'm1',
      shortcut: 'CTRL+SHIFT+K',
      onTrigger: vi.fn()
    })

    expect(registered).toBe(true)
    expect(state.callbacks.has('CommandOrControl+Shift+K')).toBe(true)
  })

  it('rejects unsupported shortcuts with multiple non-modifier keys', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    expect(manager.isShortcutFormatSupported('CTRL+O+P')).toBe(false)

    const registered = manager.registerMacro({
      macroId: 'm1',
      shortcut: 'CTRL+O+P',
      onTrigger: vi.fn()
    })

    expect(registered).toBe(false)
    expect(state.callbacks.size).toBe(0)
  })

  it('rejects shortcuts without modifier keys', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)

    expect(manager.isShortcutFormatSupported('A')).toBe(false)
    expect(manager.isShortcutFormatSupported('F8')).toBe(false)

    const registered = manager.registerMacro({
      macroId: 'm1',
      shortcut: 'A',
      onTrigger: vi.fn()
    })

    expect(registered).toBe(false)
    expect(state.callbacks.size).toBe(0)
  })

  it('suppresses shortcut callbacks while capture mode is active', () => {
    const { state, registry } = createRegistry()
    const manager = new ShortcutManager(registry)
    const onTrigger = vi.fn()

    expect(
      manager.registerMacro({
        macroId: 'm1',
        shortcut: 'CTRL+SHIFT+K',
        onTrigger
      })
    ).toBe(true)

    const callback = state.callbacks.get('CommandOrControl+Shift+K')
    expect(callback).toBeDefined()

    manager.setCaptureActive(true)
    callback?.()
    expect(onTrigger).not.toHaveBeenCalled()

    manager.setCaptureActive(false)
    callback?.()
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })
})
