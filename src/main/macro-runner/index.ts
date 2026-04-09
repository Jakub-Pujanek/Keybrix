import { RuntimeCommandSchema, type Macro, type RuntimeCommand, type SessionType } from '../../shared/api'
import {
  MAX_REPEAT_NESTING_DEPTH,
  RuntimeCompileDiagnosticSeverity,
  compileNodesToRuntime
} from '../../shared/macro-runtime'
import { executeRuntimeCommand } from './block-runtime.registry'
import { detectRuntimeSessionInfo, readSessionEnvSnapshot } from '../services/session-detection.service'

type RuntimeSettings = {
  globalMaster: boolean
  delayMs: number
  stopOnError: boolean
}

export type MacroRunnerReasonCode =
  | 'SUCCESS'
  | 'WAYLAND_BLOCKED'
  | 'COMPILE_ERROR'
  | 'ABORTED'
  | 'GLOBAL_MASTER_OFF'
  | 'COMMAND_TIMEOUT'
  | 'COMMAND_ERROR'
  | 'RUNNER_FAILED'

type RunMacroParams = {
  macro: Macro
  settings: RuntimeSettings
  onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void
  isGlobalMasterEnabled: () => boolean
  shouldAbort?: () => boolean
}

type RunMacroResult = {
  success: boolean
  reasonCode: MacroRunnerReasonCode
}

const extractCommands = (
  macro: Macro
): { commands: RuntimeCommand[]; compileDiagnostics: string[]; hasCompileErrors: boolean } => {
  const rawCommands = macro.blocksJson['commands']
  if (Array.isArray(rawCommands)) {
    return {
      commands: rawCommands
        .map((command) => RuntimeCommandSchema.safeParse(command))
        .filter((item): item is { success: true; data: RuntimeCommand } => item.success)
        .map((item) => item.data),
      compileDiagnostics: [],
      hasCompileErrors: false
    }
  }

  const compiled = compileNodesToRuntime(macro.blocksJson['nodes'])
  const compileDiagnostics = compiled.diagnostics.map((item) => item.message)

  return {
    commands: compiled.commands,
    compileDiagnostics,
    hasCompileErrors: compiled.diagnostics.some(
      (item) => item.severity === RuntimeCompileDiagnosticSeverity.ERROR
    )
  }
}

export class MacroRunner {
  private isTestEnvironment(): boolean {
    return process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true'
  }

  private logRuntimeEnvironment(
    onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void,
    detectedSessionType: string
  ): void {
    const snapshot = readSessionEnvSnapshot()
    const sessionType = snapshot.xdgSessionType ?? 'unknown'
    const display = snapshot.display ?? 'unset'
    const waylandDisplay = snapshot.waylandDisplay ?? 'unset'
    const loginctlType = snapshot.loginctlSessionType ?? 'unknown'

    onLog({
      level: 'INFO',
      message: `Runtime environment: platform=${process.platform}, session=${sessionType}, display=${display}, wayland=${waylandDisplay}, loginctl=${loginctlType}, detected=${detectedSessionType}.`
    })

    if (detectedSessionType === 'WAYLAND') {
      onLog({
        level: 'WARN',
        message:
          'Wayland session detected. Keyboard/mouse injection can be blocked by compositor security policy.'
      })
    }
  }

  private logCommandStart(
    command: RuntimeCommand,
    index: number,
    total: number,
    onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void,
    macroName: string
  ): void {
    onLog({
      level: 'RUN',
      message: `Executing '${command.type}' (${index + 1}/${total}) for '${macroName}'.`
    })
  }

  private async runCommands(
    commands: RuntimeCommand[],
    params: {
      macroName: string
      recursionDepth: number
      settings: RuntimeSettings
      sessionType: SessionType
      onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void
      isGlobalMasterEnabled: () => boolean
      shouldAbort?: () => boolean
    }
  ): Promise<RunMacroResult> {
    const { macroName, recursionDepth, settings, sessionType, onLog, isGlobalMasterEnabled, shouldAbort } = params

    if (recursionDepth > MAX_REPEAT_NESTING_DEPTH) {
      onLog({
        level: 'ERR',
        message: `Macro '${macroName}' exceeded max nested REPEAT depth (${MAX_REPEAT_NESTING_DEPTH}).`
      })
      return { success: false, reasonCode: 'RUNNER_FAILED' }
    }

    for (const [index, command] of commands.entries()) {
      if (shouldAbort?.()) {
        onLog({
          level: 'WARN',
          message: `Run aborted for '${macroName}'.`
        })
        return { success: false, reasonCode: 'ABORTED' }
      }

      if (!isGlobalMasterEnabled()) {
        onLog({
          level: 'WARN',
          message: `Global master is OFF. Stopped '${macroName}'.`
        })
        return { success: false, reasonCode: 'GLOBAL_MASTER_OFF' }
      }

      try {
        this.logCommandStart(command, index, commands.length, onLog, macroName)

        const success = await executeRuntimeCommand(command, {
          settings,
          sessionType,
          onLog,
          shouldAbort: () => shouldAbort?.() ?? false,
          isGlobalMasterEnabled,
          runNestedCommands: async (nestedCommands) => {
            const nestedResult = await this.runCommands(nestedCommands, {
              macroName,
              recursionDepth: recursionDepth + 1,
              settings,
              sessionType,
              onLog,
              isGlobalMasterEnabled,
              shouldAbort
            })

            return nestedResult.success
          }
        })

        if (!success && settings.stopOnError) {
          return { success: false, reasonCode: 'RUNNER_FAILED' }
        }

        if (success) {
          onLog({
            level: 'INFO',
            message: `Command '${command.type}' finished for '${macroName}'.`
          })
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'

        onLog({
          level: 'ERR',
          message: `Macro '${macroName}' failed on command: ${reason}.`
        })

        if (settings.stopOnError) {
          if (reason.toLowerCase().includes('timed out')) {
            return { success: false, reasonCode: 'COMMAND_TIMEOUT' }
          }

          return { success: false, reasonCode: 'COMMAND_ERROR' }
        }
      }
    }

    return { success: true, reasonCode: 'SUCCESS' }
  }

  async runMacro(params: RunMacroParams): Promise<RunMacroResult> {
    const { macro, settings, onLog, isGlobalMasterEnabled, shouldAbort } = params
    const { commands, compileDiagnostics, hasCompileErrors } = extractCommands(macro)
    const actionableCommands = commands.filter((command) => command.type !== 'START')

    onLog({
      level: 'RUN',
      message: `Manual run started for '${macro.name}'.`
    })
    const detectedSessionType = detectRuntimeSessionInfo().sessionType
    this.logRuntimeEnvironment(onLog, detectedSessionType)

    if (detectedSessionType === 'WAYLAND' && !this.isTestEnvironment()) {
      onLog({
        level: 'ERR',
        message:
          'Wayland blocks simulated keyboard/mouse input for this app. Switch to X11 session to run macro actions.'
      })
      return { success: false, reasonCode: 'WAYLAND_BLOCKED' }
    }

    for (const diagnostic of compileDiagnostics) {
      onLog({
        level: 'WARN',
        message: `Compile diagnostic for '${macro.name}': ${diagnostic}`
      })
    }

    if (actionableCommands.length === 0) {
      onLog({
        level: 'WARN',
        message: `Macro '${macro.name}' has no actionable commands (only START or empty).`
      })
    }

    if (hasCompileErrors) {
      onLog({
        level: 'ERR',
        message: `Macro '${macro.name}' has compile errors. Run aborted.`
      })
      return { success: false, reasonCode: 'COMPILE_ERROR' }
    }

    const result = await this.runCommands(commands, {
      macroName: macro.name,
      recursionDepth: 0,
      settings,
      sessionType: detectedSessionType,
      onLog,
      isGlobalMasterEnabled,
      shouldAbort
    })

    if (!result.success) {
      return result
    }

    onLog({
      level: 'INFO',
      message: `Manual run finished for '${macro.name}'.`
    })

    return { success: true, reasonCode: 'SUCCESS' }
  }
}

export const macroRunner = new MacroRunner()
