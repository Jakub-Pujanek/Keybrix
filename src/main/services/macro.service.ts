import { ToggleMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { logsService } from './logs.service'
import { macroRunner } from '../macro-runner'
import { macroRepository } from './macro.repository'
import { settingsService } from './settings.service'
import { statsService } from './stats.service'
import { shortcutManager } from '../keyboard'

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

type MacroStatusListener = (event: { id: string; newStatus: Macro['status'] }) => void

export class MacroService {
  private readonly statusListeners = new Set<MacroStatusListener>()
  private readonly activeRuns = new Set<string>()
  private readonly cancelledRuns = new Set<string>()

  getAll(): Macro[] {
    return macroRepository.getAll()
  }

  getById(id: string): Macro | null {
    return macroRepository.getById(id)
  }

  save(input: SaveMacroInput): Macro {
    const previous = input.id ? macroRepository.getById(input.id) : null

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

    const wasActive = previous?.isActive ?? false
    const isActive = macro.isActive

    if (isActive) {
      const registered = shortcutManager.registerMacro({
        macroId: macro.id,
        shortcut: macro.shortcut,
        onTrigger: () => {
          void this.run(macro.id)
        }
      })

      if (!registered) {
        throw new Error('Shortcut conflict detected.')
      }
    }

    if (wasActive && !isActive) {
      shortcutManager.unregisterByMacroId(macro.id)
    }

    this.emitStatus({
      id: macro.id,
      newStatus: macro.status
    })

    return macro
  }

  delete(id: string): boolean {
    const current = macroRepository.getById(id)
    shortcutManager.unregisterByMacroId(id)
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

    if (isActive) {
      const macro = macroRepository.getById(id)
      if (!macro) return false

      if (!shortcutManager.canRegister(id, macro.shortcut)) {
        logsService.append({
          level: 'WARN',
          message: `Shortcut conflict detected for '${macro.name}'.`
        })
        return false
      }
    }

    const toggled = macroRepository.toggleActive(id, isActive)

    if (toggled) {
      const macro = macroRepository.getById(id)
      logsService.append({
        level: 'INFO',
        message: `Macro '${macro?.name ?? id}' ${isActive ? 'enabled' : 'disabled'}.`
      })

      if (macro) {
        if (isActive) {
          const registered = shortcutManager.registerMacro({
            macroId: macro.id,
            shortcut: macro.shortcut,
            onTrigger: () => {
              void this.run(macro.id)
            }
          })

          if (!registered) {
            macroRepository.toggleActive(id, false)
            logsService.append({
              level: 'WARN',
              message: `Shortcut registration failed for '${macro.name}'.`
            })
            return false
          }
        } else {
          shortcutManager.unregisterByMacroId(macro.id)
        }

        this.emitStatus({
          id: macro.id,
          newStatus: macro.status
        })
      }
    }

    return toggled
  }

  deactivateAll(): void {
    for (const id of this.activeRuns) {
      this.cancelledRuns.add(id)
    }

    shortcutManager.unregisterAll()

    for (const macro of this.getAll()) {
      const next = macroRepository.updateRuntimeState(macro.id, 'IDLE', false)
      if (!next) continue
      this.emitStatus({ id: next.id, newStatus: next.status })
    }
  }

  bootstrapShortcuts(): void {
    for (const macro of this.getAll()) {
      if (!macro.isActive) continue

      const registered = shortcutManager.registerMacro({
        macroId: macro.id,
        shortcut: macro.shortcut,
        onTrigger: () => {
          void this.run(macro.id)
        }
      })

      if (!registered) {
        logsService.append({
          level: 'WARN',
          message: `Shortcut bootstrap failed for '${macro.name}'.`
        })
      }
    }
  }

  async run(id: string): Promise<boolean> {
    if (this.activeRuns.has(id)) {
      logsService.append({
        level: 'WARN',
        message: `Macro '${id}' is already running.`
      })
      return false
    }

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

    this.activeRuns.add(id)
    this.cancelledRuns.delete(id)

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
      isGlobalMasterEnabled: () => settingsService.get().globalMaster,
      shouldAbort: () => this.cancelledRuns.has(id)
    })

    this.activeRuns.delete(id)

    const cancelled = this.cancelledRuns.has(id)
    if (cancelled) {
      this.cancelledRuns.delete(id)
    }

    const finalStatus = !cancelled && result.success ? 'ACTIVE' : 'IDLE'
    const finalActive = !cancelled && result.success
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
