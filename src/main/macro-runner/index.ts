import type { Macro } from '../../shared/api'
import { Button, Key, keyboard, mouse, Point } from '@nut-tree-fork/nut-js'

type RuntimeSettings = {
  globalMaster: boolean
  delayMs: number
  stopOnError: boolean
}

type RuntimeCommand = {
  type?: unknown
  ms?: unknown
  payload?: unknown
  key?: unknown
  text?: unknown
}

type RunMacroParams = {
  macro: Macro
  settings: RuntimeSettings
  onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void
  isGlobalMasterEnabled: () => boolean
  shouldAbort?: () => boolean
}

const MAX_REPEAT_ITERATIONS = 1000

const keyMap: Record<string, Key> = {
  CTRL: Key.LeftControl,
  CONTROL: Key.LeftControl,
  SHIFT: Key.LeftShift,
  ALT: Key.LeftAlt,
  CMD: Key.LeftSuper,
  META: Key.LeftSuper,
  ENTER: Key.Enter,
  SPACE: Key.Space,
  TAB: Key.Tab,
  ESC: Key.Escape,
  BACKSPACE: Key.Backspace,
  DELETE: Key.Delete,
  UP: Key.Up,
  DOWN: Key.Down,
  LEFT: Key.Left,
  RIGHT: Key.Right
}

const mouseButtonMap: Record<string, Button> = {
  LEFT: Button.LEFT,
  RIGHT: Button.RIGHT,
  MIDDLE: Button.MIDDLE
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

const resolveKey = (token: string): Key => {
  const upper = token.toUpperCase()
  if (keyMap[upper]) {
    return keyMap[upper]
  }

  if (/^[A-Z]$/.test(upper)) {
    const alpha = (Key as unknown as Record<string, Key>)[upper]
    if (alpha !== undefined) {
      return alpha
    }
  }

  if (/^F([1-9]|1[0-2])$/.test(upper)) {
    const fnKey = (Key as unknown as Record<string, Key>)[upper]
    if (fnKey !== undefined) {
      return fnKey
    }
  }

  throw new Error(`Unsupported key token '${token}'`)
}

const extractShortcutTokens = (command: RuntimeCommand): string[] => {
  if (typeof command.key === 'string' && command.key.trim().length > 0) {
    return command.key.split('+').map((chunk) => chunk.trim())
  }

  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { key?: unknown; keys?: unknown; value?: unknown }
    const source = [payload.key, payload.keys, payload.value].find(
      (item) => typeof item === 'string' && item.trim().length > 0
    )

    if (typeof source === 'string') {
      return source.split('+').map((chunk) => chunk.trim())
    }
  }

  throw new Error('PRESS_KEY command is missing key payload')
}

const runPressKey = async (command: RuntimeCommand): Promise<void> => {
  const tokens = extractShortcutTokens(command)
  const keys = tokens.map((token) => resolveKey(token))

  if (keys.length === 0) {
    throw new Error('PRESS_KEY command has no keys to press')
  }

  await keyboard.pressKey(...keys)
  await keyboard.releaseKey(...keys.reverse())
}

const runTypeText = async (command: RuntimeCommand): Promise<void> => {
  let text: string | undefined

  if (typeof command.text === 'string') {
    text = command.text
  }

  if (!text && command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { text?: unknown; value?: unknown }
    if (typeof payload.text === 'string') {
      text = payload.text
    } else if (typeof payload.value === 'string') {
      text = payload.value
    }
  }

  if (!text) {
    throw new Error('TYPE_TEXT command is missing text payload')
  }

  await keyboard.type(text)
}

const runMouseClick = async (command: RuntimeCommand): Promise<void> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('MOUSE_CLICK command is missing payload')
  }

  const payload = command.payload as { x?: unknown; y?: unknown; button?: unknown }
  if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
    throw new Error('MOUSE_CLICK requires numeric x and y')
  }

  const buttonLabel =
    typeof payload.button === 'string' && payload.button.trim().length > 0
      ? payload.button.toUpperCase()
      : 'LEFT'
  const button = mouseButtonMap[buttonLabel]
  if (!button) {
    throw new Error(`Unsupported mouse button '${buttonLabel}'`)
  }

  await mouse.setPosition(new Point(payload.x, payload.y))
  await mouse.click(button)
}

const extractRepeat = (command: RuntimeCommand): { count: number; commands: RuntimeCommand[] } => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('REPEAT command is missing payload')
  }

  const payload = command.payload as { count?: unknown; commands?: unknown }
  const rawCount = typeof payload.count === 'number' ? Math.floor(payload.count) : 1
  const count = Math.max(0, Math.min(MAX_REPEAT_ITERATIONS, rawCount))
  if (!Array.isArray(payload.commands)) {
    throw new Error('REPEAT command is missing nested commands array')
  }

  return {
    count,
    commands: payload.commands as RuntimeCommand[]
  }
}

export class MacroRunner {
  async runMacro(params: RunMacroParams): Promise<{ success: boolean }> {
    const { macro, settings, onLog, isGlobalMasterEnabled, shouldAbort } = params
    const commands = extractCommands(macro)

    onLog({
      level: 'RUN',
      message: `Manual run started for '${macro.name}'.`
    })

    for (const command of commands) {
      if (shouldAbort?.()) {
        onLog({
          level: 'WARN',
          message: `Run aborted for '${macro.name}'.`
        })
        return { success: false }
      }

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

        if (commandType === 'PRESS_KEY') {
          await runPressKey(command)
          await sleep(settings.delayMs)
          continue
        }

        if (commandType === 'TYPE_TEXT') {
          await runTypeText(command)
          await sleep(settings.delayMs)
          continue
        }

        if (commandType === 'MOUSE_CLICK') {
          await runMouseClick(command)
          await sleep(settings.delayMs)
          continue
        }

        if (commandType === 'WAIT') {
          const waitMs = resolveWaitDuration(command, settings.delayMs)
          await sleep(waitMs)
          continue
        }

        if (commandType === 'REPEAT') {
          const repeat = extractRepeat(command)
          for (let index = 0; index < repeat.count; index += 1) {
            for (const nested of repeat.commands) {
              if (shouldAbort?.() || !isGlobalMasterEnabled()) {
                return { success: false }
              }

              const nestedResult = await this.runMacro({
                macro: {
                  ...macro,
                  blocksJson: {
                    commands: [nested]
                  }
                },
                settings,
                onLog,
                isGlobalMasterEnabled,
                shouldAbort
              })

              if (!nestedResult.success && settings.stopOnError) {
                return { success: false }
              }
            }
          }
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
