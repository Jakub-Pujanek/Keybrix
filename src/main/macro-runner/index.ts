import type { Macro } from '../../shared/api'

type RuntimeSettings = {
  globalMaster: boolean
  delayMs: number
  stopOnError: boolean
}

type RuntimeCommand = {
  type?: unknown
  ms?: unknown
  payload?: unknown
}

type RunMacroParams = {
  macro: Macro
  settings: RuntimeSettings
  onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void
  isGlobalMasterEnabled: () => boolean
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const extractCommands = (macro: Macro): RuntimeCommand[] => {
  const rawCommands = macro.blocksJson['commands']
  if (Array.isArray(rawCommands)) {
    return rawCommands as RuntimeCommand[]
  }

  const rawNodes = macro.blocksJson['nodes']
  if (!Array.isArray(rawNodes)) return []

  const commands: RuntimeCommand[] = []

  for (const node of rawNodes) {
    if (!node || typeof node !== 'object') continue
    const next = node as { type?: unknown; payload?: unknown }
    commands.push({
      type: next.type,
      payload: next.payload
    })
  }

  return commands
}

const resolveWaitDuration = (command: RuntimeCommand, fallbackMs: number): number => {
  if (typeof command.ms === 'number') {
    return Math.max(0, Math.round(command.ms))
  }

  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { durationMs?: unknown }
    if (typeof payload.durationMs === 'number') {
      return Math.max(0, Math.round(payload.durationMs))
    }
  }

  return fallbackMs
}

export class MacroRunner {
  async runMacro(params: RunMacroParams): Promise<{ success: boolean }> {
    const { macro, settings, onLog, isGlobalMasterEnabled } = params
    const commands = extractCommands(macro)

    onLog({
      level: 'RUN',
      message: `Manual run started for '${macro.name}'.`
    })

    for (const command of commands) {
      if (!isGlobalMasterEnabled()) {
        onLog({
          level: 'WARN',
          message: `Global master is OFF. Stopped '${macro.name}'.`
        })
        return { success: false }
      }

      try {
        const commandType = typeof command.type === 'string' ? command.type : undefined
        if (!commandType) {
          throw new Error('Missing command type')
        }

        if (commandType === 'WAIT') {
          const waitMs = resolveWaitDuration(command, settings.delayMs)
          await sleep(waitMs)
          continue
        }

        if (commandType === 'INFINITE_LOOP') {
          onLog({
            level: 'WARN',
            message: `Skipped unsupported INFINITE_LOOP in '${macro.name}'.`
          })
          continue
        }

        await sleep(settings.delayMs)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'

        onLog({
          level: 'ERR',
          message: `Macro '${macro.name}' failed on command: ${reason}.`
        })

        if (settings.stopOnError) {
          return { success: false }
        }
      }
    }

    onLog({
      level: 'INFO',
      message: `Manual run finished for '${macro.name}'.`
    })

    return { success: true }
  }
}

export const macroRunner = new MacroRunner()
