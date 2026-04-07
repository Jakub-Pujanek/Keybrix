import { ToggleMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { logsService } from './logs.service'
import { macroRunner } from '../macro-runner'
import { macroRepository } from './macro.repository'
import { settingsService } from './settings.service'
import { statsService } from './stats.service'

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

type MacroStatusListener = (event: { id: string; newStatus: Macro['status'] }) => void

export class MacroService {
  private readonly statusListeners = new Set<MacroStatusListener>()

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

    this.emitStatus({
      id: macro.id,
      newStatus: macro.status
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

    if (isActive && !settingsService.get().globalMaster) {
      const macro = macroRepository.getById(id)
      logsService.append({
        level: 'WARN',
        message: `Global master is OFF. Activation blocked for '${macro?.name ?? id}'.`
      })
      return false
    }

    const toggled = macroRepository.toggleActive(id, isActive)

    if (toggled) {
      const macro = macroRepository.getById(id)
      logsService.append({
        level: 'INFO',
        message: `Macro '${macro?.name ?? id}' ${isActive ? 'enabled' : 'disabled'}.`
      })

      if (macro) {
        this.emitStatus({
          id: macro.id,
          newStatus: macro.status
        })
      }
    }

    return toggled
  }

  deactivateAll(): void {
    for (const macro of this.getAll()) {
      const next = macroRepository.updateRuntimeState(macro.id, 'IDLE', false)
      if (!next) continue
      this.emitStatus({ id: next.id, newStatus: next.status })
    }
  }

  async run(id: string): Promise<boolean> {
    const macro = macroRepository.getById(id)
    if (!macro) return false

    const settings = settingsService.get()
    if (!settings.globalMaster) {
      logsService.append({
        level: 'WARN',
        message: `Global master is OFF. Manual run blocked for '${macro.name}'.`
      })
      return false
    }

    const running = macroRepository.updateRuntimeState(id, 'RUNNING', true)
    if (!running) return false

    this.emitStatus({ id, newStatus: 'RUNNING' })

    const result = await macroRunner.runMacro({
      macro: running,
      settings: {
        globalMaster: settings.globalMaster,
        delayMs: settings.delayMs,
        stopOnError: settings.stopOnError
      },
      onLog: ({ level, message }) => {
        logsService.append({ level, message })
      },
      isGlobalMasterEnabled: () => settingsService.get().globalMaster
    })

    const finalStatus = result.success ? 'ACTIVE' : 'IDLE'
    const finalActive = result.success
    const finished = macroRepository.updateRuntimeState(id, finalStatus, finalActive)

    if (finished) {
      this.emitStatus({ id: finished.id, newStatus: finished.status })
      statsService.recordRun({
        success: result.success,
        timeSavedMinutes: result.success ? 1 : 0
      })
    }

    return result.success
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

  onStatusChange(listener: MacroStatusListener): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private emitStatus(event: { id: string; newStatus: Macro['status'] }): void {
    for (const listener of this.statusListeners) {
      listener(event)
    }
  }
}

export const macroService = new MacroService()
