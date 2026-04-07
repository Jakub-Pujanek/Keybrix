import { globalShortcut } from 'electron'

type ShortcutRegistry = Pick<
  typeof globalShortcut,
  'register' | 'unregister' | 'isRegistered' | 'unregisterAll'
>

type RegisterInput = {
  macroId: string
  shortcut: string
  onTrigger: () => void
}

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

export class ShortcutManager {
  private readonly registry: ShortcutRegistry
  private readonly macroShortcutMap = new Map<string, string>()
  private readonly shortcutMacroMap = new Map<string, string>()

  constructor(registry: ShortcutRegistry = globalShortcut) {
    this.registry = registry
  }

  canRegister(macroId: string, shortcut: string): boolean {
    const normalized = normalizeShortcut(shortcut)
    const owner = this.shortcutMacroMap.get(normalized)

    if (owner && owner !== macroId) {
      return false
    }

    if (this.registry.isRegistered(normalized) && owner !== macroId) {
      return false
    }

    return true
  }

  registerMacro(input: RegisterInput): boolean {
    const normalized = normalizeShortcut(input.shortcut)
    if (!this.canRegister(input.macroId, normalized)) {
      return false
    }

    const previous = this.macroShortcutMap.get(input.macroId)
    if (previous && previous !== normalized) {
      this.unregisterByMacroId(input.macroId)
    }

    if (previous === normalized) {
      return true
    }

    const registered = this.registry.register(normalized, input.onTrigger)
    if (!registered) {
      return false
    }

    this.macroShortcutMap.set(input.macroId, normalized)
    this.shortcutMacroMap.set(normalized, input.macroId)

    return true
  }

  unregisterByMacroId(macroId: string): void {
    const shortcut = this.macroShortcutMap.get(macroId)
    if (!shortcut) return

    this.registry.unregister(shortcut)
    this.macroShortcutMap.delete(macroId)
    this.shortcutMacroMap.delete(shortcut)
  }

  unregisterAll(): void {
    for (const shortcut of this.shortcutMacroMap.keys()) {
      this.registry.unregister(shortcut)
    }

    this.macroShortcutMap.clear()
    this.shortcutMacroMap.clear()
  }

  dispose(): void {
    this.unregisterAll()
    this.registry.unregisterAll()
  }
}

export const shortcutManager = new ShortcutManager()
