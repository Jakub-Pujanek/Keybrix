import { ToggleMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { logsService } from './logs.service'
import { macroRepository } from './macro.repository'

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

export class MacroService {
  getAll(): Macro[] {
    return macroRepository.getAll()
  }

  getById(id: string): Macro | null {
    return macroRepository.getById(id)
  }

  save(input: SaveMacroInput): Macro {
    const normalizedInput: SaveMacroInput = {
      ...input,
      shortcut: input.shortcut ? normalizeShortcut(input.shortcut) : input.shortcut
    }

    if (
      normalizedInput.shortcut &&
      this.hasShortcutConflict(normalizedInput.shortcut, normalizedInput.id)
    ) {
      throw new Error('Shortcut conflict detected.')
    }

    const macro = macroRepository.save(normalizedInput)
    logsService.append({
      level: 'INFO',
      message: `Macro '${macro.name}' saved.`
    })

    return macro
  }

  delete(id: string): boolean {
    const current = macroRepository.getById(id)
    const deleted = macroRepository.delete(id)

    if (deleted) {
      logsService.append({
        level: 'WARN',
        message: `Macro '${current?.name ?? id}' deleted.`
      })
    }

    return deleted
  }

  toggle(id: string, isActive: boolean): boolean {
    ToggleMacroInputSchema.parse({ id, isActive })
    const toggled = macroRepository.toggleActive(id, isActive)

    if (toggled) {
      const macro = macroRepository.getById(id)
      logsService.append({
        level: 'INFO',
        message: `Macro '${macro?.name ?? id}' ${isActive ? 'enabled' : 'disabled'}.`
      })
    }

    return toggled
  }

  reserveShortcut(input: {
    keys: string
    source: 'topbar' | 'start-block' | 'press-key-block'
  }): boolean {
    const normalized = normalizeShortcut(input.keys)
    if (this.hasShortcutConflict(normalized)) {
      return false
    }

    logsService.append({
      level: 'INFO',
      message: `Shortcut '${normalized}' reserved from '${input.source}'.`
    })

    return true
  }

  private hasShortcutConflict(shortcut: string, exceptId?: string): boolean {
    return this.getAll().some((macro) => {
      if (exceptId && macro.id === exceptId) return false
      return normalizeShortcut(macro.shortcut) === shortcut
    })
  }
}

export const macroService = new MacroService()
