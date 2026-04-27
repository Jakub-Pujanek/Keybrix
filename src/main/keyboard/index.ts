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

const isModifierToken = (token: string): boolean => {
  return (
    token === 'CTRL' ||
    token === 'CONTROL' ||
    token === 'CMDORCTRL' ||
    token === 'COMMANDORCONTROL' ||
    token === 'SHIFT' ||
    token === 'ALT' ||
    token === 'OPTION' ||
    token === 'CMD' ||
    token === 'COMMAND' ||
    token === 'META' ||
    token === 'SUPER'
  )
}

const hasModifierToken = (tokens: string[]): boolean => {
  return tokens.some((token) => isModifierToken(token))
}

const toElectronAccelerator = (shortcut: string): string | null => {
  const tokens = normalizeShortcut(shortcut)
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  let nonModifierCount = 0

  const mapped = tokens.map((token) => {
    if (
      token === 'CTRL' ||
      token === 'CONTROL' ||
      token === 'CMDORCTRL' ||
      token === 'COMMANDORCONTROL'
    ) {
      return 'CommandOrControl'
    }

    if (token === 'SHIFT') {
      return 'Shift'
    }

    if (token === 'ALT' || token === 'OPTION') {
      return 'Alt'
    }

    if (token === 'CMD' || token === 'COMMAND' || token === 'META' || token === 'SUPER') {
      return 'Super'
    }

    if (token.length === 1 && /[A-Z0-9]/.test(token)) {
      nonModifierCount += 1
      return token
    }

    if (/^F([1-9]|1[0-2])$/.test(token)) {
      nonModifierCount += 1
      return token
    }

    if (token === 'ENTER') {
      nonModifierCount += 1
      return 'Enter'
    }
    if (token === 'SPACE') {
      nonModifierCount += 1
      return 'Space'
    }
    if (token === 'TAB') {
      nonModifierCount += 1
      return 'Tab'
    }
    if (token === 'ESC') {
      nonModifierCount += 1
      return 'Esc'
    }
    if (token === 'BACKSPACE') {
      nonModifierCount += 1
      return 'Backspace'
    }
    if (token === 'DELETE') {
      nonModifierCount += 1
      return 'Delete'
    }
    if (token === 'UP') {
      nonModifierCount += 1
      return 'Up'
    }
    if (token === 'DOWN') {
      nonModifierCount += 1
      return 'Down'
    }
    if (token === 'LEFT') {
      nonModifierCount += 1
      return 'Left'
    }
    if (token === 'RIGHT') {
      nonModifierCount += 1
      return 'Right'
    }

    return null
  })

  if (mapped.some((token) => token === null)) {
    return null
  }

  if (nonModifierCount !== 1) {
    return null
  }

  if (!hasModifierToken(tokens)) {
    return null
  }

  return mapped.join('+')
}

export class ShortcutManager {
  private readonly registry: ShortcutRegistry
  private readonly macroShortcutMap = new Map<string, string>()
  private readonly shortcutMacroMap = new Map<string, string>()

  constructor(registry: ShortcutRegistry = globalShortcut) {
    this.registry = registry
  }

  isShortcutFormatSupported(shortcut: string): boolean {
    return toElectronAccelerator(shortcut) !== null
  }

  canRegister(macroId: string, shortcut: string): boolean {
    const accelerator = toElectronAccelerator(shortcut)
    if (!accelerator) {
      return false
    }

    const owner = this.shortcutMacroMap.get(accelerator)

    if (owner && owner !== macroId) {
      return false
    }

    return true
  }

  registerMacro(input: RegisterInput): boolean {
    const accelerator = toElectronAccelerator(input.shortcut)
    if (!accelerator) {
      return false
    }

    if (!this.canRegister(input.macroId, input.shortcut)) {
      return false
    }

    const previous = this.macroShortcutMap.get(input.macroId)
    if (previous && previous !== accelerator) {
      this.unregisterByMacroId(input.macroId)
    }

    if (previous === accelerator) {
      return true
    }

    // Recover from stale app-level registrations (e.g. dev main reload) not tracked in maps.
    if (
      this.registry.isRegistered(accelerator) &&
      this.shortcutMacroMap.get(accelerator) !== input.macroId
    ) {
      this.registry.unregister(accelerator)
    }

    let registered = false
    try {
      registered = this.registry.register(accelerator, input.onTrigger)
    } catch {
      registered = false
    }

    if (!registered) {
      return false
    }

    this.macroShortcutMap.set(input.macroId, accelerator)
    this.shortcutMacroMap.set(accelerator, input.macroId)

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
