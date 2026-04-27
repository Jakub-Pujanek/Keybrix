import { ToggleMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { logsService } from './logs.service'
import { macroRepository } from './macro.repository'
import { settingsService } from './settings.service'
import { statsService } from './stats.service'
import { shortcutManager } from '../keyboard'
import { structuredLogger } from './structured-logger.service'
import type { MacroRunner, MacroRunnerReasonCode } from '../macro-runner'

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

type MacroStatusListener = (event: { id: string; newStatus: Macro['status'] }) => void

export type MacroServiceRunResult = {
  runId: string
  success: boolean
  reasonCode:
    | MacroRunnerReasonCode
    | 'ALREADY_RUNNING'
    | 'NOT_RUNNING'
    | 'MACRO_NOT_FOUND'
    | 'GLOBAL_MASTER_OFF'
}

export class MacroService {
  private readonly statusListeners = new Set<MacroStatusListener>()
  private readonly activeRuns = new Set<string>()
  private readonly cancelledRuns = new Set<string>()
  private macroRunnerPromise: Promise<MacroRunner> | null = null

  private async getMacroRunner(): Promise<MacroRunner> {
    if (!this.macroRunnerPromise) {
      this.macroRunnerPromise = this.loadMacroRunner()
    }

    return this.macroRunnerPromise
  }

  private async loadMacroRunner(): Promise<MacroRunner> {
    const originalEmitWarning = process.emitWarning
    const patchedEmitWarning = ((warning: string | Error, ...rest: unknown[]): void => {
      const warningMessage = typeof warning === 'string' ? warning : warning.message
      const maybeCode = typeof rest[1] === 'string' ? rest[1] : undefined
      const warningCode =
        typeof warning === 'object' && warning && 'code' in warning
          ? String((warning as { code?: unknown }).code ?? '')
          : (maybeCode ?? '')

      if (
        warningCode === 'DEP0040' ||
        warningMessage.includes('The `punycode` module is deprecated')
      ) {
        return
      }

      originalEmitWarning.call(process, warning, ...(rest as []))
    }) as typeof process.emitWarning

    process.emitWarning = patchedEmitWarning

    try {
      const module = await import('../macro-runner')
      return module.macroRunner
    } finally {
      process.emitWarning = originalEmitWarning
    }
  }

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

    if (
      normalizedInput.shortcut &&
      !shortcutManager.isShortcutFormatSupported(normalizedInput.shortcut)
    ) {
      throw new Error('Invalid shortcut format. Use modifiers plus exactly one key.')
    }

    let macro = macroRepository.save(normalizedInput)
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
          void this.triggerByShortcut(macro.id)
        }
      })

      if (!registered) {
        macroRepository.toggleActive(macro.id, false)
        macro = macroRepository.getById(macro.id) ?? macro

        logsService.append({
          level: 'WARN',
          message: `Global shortcut '${macro.shortcut}' could not be registered. Macro was saved as disabled.`
        })
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

    if (this.activeRuns.has(id)) {
      this.cancelledRuns.add(id)
    }

    shortcutManager.unregisterByMacroId(id)
    const deleted = macroRepository.delete(id)

    if (deleted) {
      logsService.append({
        level: 'WARN',
        message: `Macro '${current?.name ?? id}' deleted.`
      })
      structuredLogger.audit({
        action: 'MACRO_DELETED',
        targetId: id
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

      if (!shortcutManager.isShortcutFormatSupported(macro.shortcut)) {
        logsService.append({
          level: 'WARN',
          message: `Shortcut '${macro.shortcut}' has unsupported format.`
        })
        return false
      }

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
              void this.triggerByShortcut(macro.id)
            }
          })

          if (!registered) {
            macroRepository.toggleActive(id, false)
            logsService.append({
              level: 'WARN',
              message: `Shortcut registration failed for '${macro.name}'.`
            })
            
            this.emitStatus({
              id: macro.id,
              newStatus: 'IDLE'
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

        structuredLogger.audit({
          action: 'MACRO_TOGGLED',
          targetId: macro.id,
          meta: {
            isActive
          }
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
      const next = macroRepository.updateRuntimeState(macro.id, 'IDLE')
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
          void this.triggerByShortcut(macro.id)
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

  reconcileRuntimeStatuses(): void {
    for (const macro of this.getAll()) {
      const expectedStatus: Macro['status'] = macro.isActive ? 'ACTIVE' : 'IDLE'
      if (macro.status === expectedStatus) continue

      const updated = macroRepository.updateRuntimeState(macro.id, expectedStatus)
      if (!updated) continue

      this.emitStatus({
        id: updated.id,
        newStatus: updated.status
      })

      logsService.append({
        level: 'INFO',
        message: `Runtime status reconciled for '${updated.name}' (${macro.status} -> ${updated.status}).`
      })
    }
  }

  async run(id: string): Promise<MacroServiceRunResult> {
    const runId = globalThis.crypto.randomUUID()
    logsService.append({
      level: 'RUN',
      runId,
      message: `Manual run request received for macro '${id}'.`
    })

    const finalize = (result: MacroServiceRunResult): MacroServiceRunResult => {
      logsService.append({
        level: result.success ? 'INFO' : 'WARN',
        runId,
        message: `Manual run finished for macro '${id}' with reason '${result.reasonCode}'.`
      })

      return result
    }

    try {
      if (this.activeRuns.has(id)) {
        logsService.append({
          level: 'WARN',
          runId,
          message: `Macro '${id}' is already running.`
        })
        structuredLogger.audit({
          action: 'MACRO_RUN_BLOCKED',
          targetId: id,
          reason: 'already-running'
        })
        return finalize({ runId, success: false, reasonCode: 'ALREADY_RUNNING' })
      }

      const macro = macroRepository.getById(id)
      if (!macro) {
        logsService.append({
          level: 'WARN',
          runId,
          message: `Macro '${id}' was not found.`
        })
        return finalize({ runId, success: false, reasonCode: 'MACRO_NOT_FOUND' })
      }

      const settings = settingsService.get()
      if (!settings.globalMaster) {
        logsService.append({
          level: 'WARN',
          runId,
          message: `Global master is OFF. Manual run blocked for '${macro.name}'.`
        })
        structuredLogger.audit({
          action: 'MACRO_RUN_BLOCKED',
          targetId: id,
          reason: 'global-master-off'
        })
        return finalize({ runId, success: false, reasonCode: 'GLOBAL_MASTER_OFF' })
      }

      const running = macroRepository.updateRuntimeState(id, 'RUNNING')
      if (!running) {
        logsService.append({
          level: 'ERR',
          runId,
          message: `Macro '${id}' failed to enter RUNNING state.`
        })
        return finalize({ runId, success: false, reasonCode: 'RUNNER_FAILED' })
      }

      this.activeRuns.add(id)
      this.cancelledRuns.delete(id)

      this.emitStatus({ id, newStatus: 'RUNNING' })

      const macroRunner = await this.getMacroRunner()
      const result = await macroRunner.runMacro({
        macro: running,
        settings: {
          globalMaster: settings.globalMaster,
          delayMs: settings.delayMs,
          stopOnError: settings.stopOnError
        },
        onLog: ({ level, message }) => {
          logsService.append({ level, message, runId })
        },
        isGlobalMasterEnabled: () => settingsService.get().globalMaster,
        shouldAbort: () => this.cancelledRuns.has(id)
      })

      this.activeRuns.delete(id)

      const cancelled = this.cancelledRuns.has(id)
      if (cancelled) {
        this.cancelledRuns.delete(id)
      }

      const normalizedReasonCode =
        result.reasonCode ?? (result.success ? 'SUCCESS' : 'RUNNER_FAILED')

      const effectiveResult: MacroServiceRunResult = cancelled
        ? { runId, success: false, reasonCode: 'ABORTED' }
        : { runId, success: result.success, reasonCode: normalizedReasonCode }

      const finalStatus = effectiveResult.success ? 'ACTIVE' : 'IDLE'
      const finished = macroRepository.updateRuntimeState(id, finalStatus)

      if (finished) {
        this.emitStatus({ id: finished.id, newStatus: finished.status })
        statsService.recordRun({
          success: effectiveResult.success,
          timeSavedMinutes: effectiveResult.success ? 1 : 0
        })

        structuredLogger.audit({
          action: effectiveResult.success ? 'MACRO_RUN' : 'MACRO_RUN_BLOCKED',
          targetId: finished.id,
          reason: effectiveResult.success ? undefined : effectiveResult.reasonCode.toLowerCase()
        })
      }

      return finalize(effectiveResult)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      logsService.append({
        level: 'ERR',
        runId,
        message: `Manual run crashed for macro '${id}': ${reason}.`
      })

      structuredLogger.error('Macro run crashed unexpectedly.', {
        scope: 'macro.service.run',
        reason,
        details: {
          id,
          runId
        }
      })

      this.activeRuns.delete(id)
      this.cancelledRuns.delete(id)

      return finalize({ runId, success: false, reasonCode: 'RUNNER_FAILED' })
    }
  }

  async triggerByShortcut(id: string): Promise<MacroServiceRunResult> {
    const macro = macroRepository.getById(id)
    if (!macro || !macro.isActive) {
      const runId = globalThis.crypto.randomUUID()
      logsService.append({
        level: 'WARN',
        runId,
        message: `Shortcut triggered but macro '${id}' is not active or not found.`
      })
      return { runId, success: false, reasonCode: 'NOT_RUNNING' }
    }

    if (this.activeRuns.has(id)) {
      const runId = globalThis.crypto.randomUUID()
      this.cancelledRuns.add(id)
      logsService.append({
        level: 'INFO',
        runId,
        message: `Shortcut trigger requested stop for macro '${id}'.`
      })
      return { runId, success: false, reasonCode: 'ABORTED' }
    }

    logsService.append({
      level: 'RUN',
      message: `Shortcut trigger requested start for macro '${id}'.`
    })
    return this.run(id)
  }

  stop(id: string): MacroServiceRunResult {
    const runId = globalThis.crypto.randomUUID()
    const macro = macroRepository.getById(id)

    if (!macro) {
      logsService.append({
        level: 'WARN',
        runId,
        message: `Stop request failed. Macro '${id}' was not found.`
      })
      return { runId, success: false, reasonCode: 'MACRO_NOT_FOUND' }
    }

    if (!this.activeRuns.has(id)) {
      logsService.append({
        level: 'INFO',
        runId,
        message: `Stop request ignored for '${macro.name}' because it is not running.`
      })
      return { runId, success: false, reasonCode: 'NOT_RUNNING' }
    }

    this.cancelledRuns.add(id)

    logsService.append({
      level: 'INFO',
      runId,
      message: `Stop request accepted for '${macro.name}'.`
    })

    return { runId, success: true, reasonCode: 'ABORTED' }
  }

  reserveShortcut(input: {
    keys: string
    source: 'topbar' | 'start-block' | 'press-key-block' | 'execute-shortcut-block'
  }): boolean {
    const normalized = normalizeShortcut(input.keys)
    if (!shortcutManager.isShortcutFormatSupported(normalized)) {
      return false
    }

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
