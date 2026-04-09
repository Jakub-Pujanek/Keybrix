import { Button, Key, keyboard, mouse, Point } from '@nut-tree-fork/nut-js'
import {
  RuntimeCommandSchema,
  type EditorBlockType,
  type RuntimeCommand,
  type SessionType
} from '../../shared/api'
import { BLOCK_REGISTRY_BY_TYPE } from '../../shared/block-registry'
import { MAX_REPEAT_ITERATIONS, MAX_REPEAT_NESTED_COMMANDS } from '../../shared/macro-runtime'

type RuntimeSettings = {
  delayMs: number
  stopOnError: boolean
}

type RuntimeExecutionContext = {
  settings: RuntimeSettings
  sessionType: SessionType
  onLog: (entry: { level: 'RUN' | 'INFO' | 'WARN' | 'ERR'; message: string }) => void
  shouldAbort: () => boolean
  isGlobalMasterEnabled: () => boolean
  runNestedCommands: (commands: RuntimeCommand[]) => Promise<boolean>
}

type RuntimeCommandHandler = (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
) => Promise<boolean>

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

type CommandTimeoutKind = 'keyboard' | 'mouse'

const getCommandTimeoutMs = (kind: CommandTimeoutKind, sessionType: SessionType): number => {
  const isWayland = sessionType === 'WAYLAND'

  if (kind === 'keyboard') {
    return isWayland ? 5000 : 2500
  }

  return isWayland ? 4000 : 2000
}

const executeWithTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)
    })

    return await Promise.race([operation(), timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

const resolveWaitDuration = (command: RuntimeCommand, fallbackMs: number): number => {
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
  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { key?: unknown }
    const source = [payload.key].find((item) => typeof item === 'string' && item.trim().length > 0)

    if (typeof source === 'string') {
      return source.split('+').map((chunk) => chunk.trim())
    }
  }

  throw new Error('PRESS_KEY command is missing key payload')
}

const runPressKey = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  const tokens = extractShortcutTokens(command)
  const keys = tokens.map((token) => resolveKey(token))

  if (keys.length === 0) {
    throw new Error('PRESS_KEY command has no keys to press')
  }

  context.onLog({
    level: 'RUN',
    message: `Pressing key combination: ${tokens.join(' + ')}.`
  })
  const keyboardTimeoutMs = getCommandTimeoutMs('keyboard', context.sessionType)
  await executeWithTimeout(
    () => keyboard.pressKey(...keys),
    keyboardTimeoutMs,
    `PRESS_KEY timed out after ${keyboardTimeoutMs}ms while pressing '${tokens.join(' + ')}'.`
  )
  await executeWithTimeout(
    () => keyboard.releaseKey(...keys.reverse()),
    keyboardTimeoutMs,
    `PRESS_KEY timed out after ${keyboardTimeoutMs}ms while releasing '${tokens.join(' + ')}'.`
  )
  context.onLog({
    level: 'INFO',
    message: `Pressed key combination: ${tokens.join(' + ')}.`
  })
}

const runTypeText = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  let text: string | undefined

  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { text?: unknown }
    if (typeof payload.text === 'string') {
      text = payload.text
    }
  }

  if (!text) {
    throw new Error('TYPE_TEXT command is missing text payload')
  }

  context.onLog({
    level: 'RUN',
    message: `Typing text (${text.length} chars).`
  })
  const keyboardTimeoutMs = getCommandTimeoutMs('keyboard', context.sessionType)
  await executeWithTimeout(
    () => keyboard.type(text),
    keyboardTimeoutMs,
    `TYPE_TEXT timed out after ${keyboardTimeoutMs}ms.`
  )
  context.onLog({
    level: 'INFO',
    message: 'Text typing finished.'
  })
}

const runMouseClick = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('MOUSE_CLICK command is missing payload')
  }

  const payload = command.payload as { x?: unknown; y?: unknown; button?: unknown }
  if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
    throw new Error('MOUSE_CLICK requires numeric x and y')
  }
  const x = payload.x
  const y = payload.y

  const buttonLabel =
    typeof payload.button === 'string' && payload.button.trim().length > 0
      ? payload.button.toUpperCase()
      : 'LEFT'
  const button = mouseButtonMap[buttonLabel]
  if (!button) {
    throw new Error(`Unsupported mouse button '${buttonLabel}'`)
  }

  context.onLog({
    level: 'RUN',
    message: `Clicking mouse '${buttonLabel}' at (${x}, ${y}).`
  })
  const mouseTimeoutMs = getCommandTimeoutMs('mouse', context.sessionType)
  await executeWithTimeout(
    () => mouse.setPosition(new Point(x, y)),
    mouseTimeoutMs,
    `MOUSE_CLICK timed out after ${mouseTimeoutMs}ms while moving cursor.`
  )
  await executeWithTimeout(
    () => mouse.click(button),
    mouseTimeoutMs,
    `MOUSE_CLICK timed out after ${mouseTimeoutMs}ms while clicking '${buttonLabel}'.`
  )
  context.onLog({
    level: 'INFO',
    message: `Mouse '${buttonLabel}' click finished.`
  })
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

  const nestedCommands = payload.commands
    .slice(0, MAX_REPEAT_NESTED_COMMANDS)
    .map((item) => RuntimeCommandSchema.safeParse(item))

  if (nestedCommands.some((item) => !item.success)) {
    throw new Error('REPEAT command contains invalid nested command payload')
  }

  const parsedNestedCommands = nestedCommands
    .filter((item): item is { success: true; data: RuntimeCommand } => item.success)
    .map((item) => item.data)

  return {
    count,
    commands: parsedNestedCommands
  }
}

export const BLOCK_RUNTIME_REGISTRY: Readonly<Record<EditorBlockType, RuntimeCommandHandler>> = {
  START: async () => {
    return true
  },
  PRESS_KEY: async (command, context) => {
    await runPressKey(command, context)
    await sleep(context.settings.delayMs)
    return true
  },
  TYPE_TEXT: async (command, context) => {
    await runTypeText(command, context)
    await sleep(context.settings.delayMs)
    return true
  },
  MOUSE_CLICK: async (command, context) => {
    await runMouseClick(command, context)
    await sleep(context.settings.delayMs)
    return true
  },
  WAIT: async (command, context) => {
    const waitMs = resolveWaitDuration(command, context.settings.delayMs)
    context.onLog({
      level: 'RUN',
      message: `Waiting ${waitMs}ms.`
    })
    await sleep(waitMs)
    context.onLog({
      level: 'INFO',
      message: `Waited ${waitMs}ms.`
    })
    return true
  },
  REPEAT: async (command, context) => {
    const repeat = extractRepeat(command)
    context.onLog({
      level: 'RUN',
      message: `Starting repeat block (${repeat.count} iterations).`
    })

    for (let index = 0; index < repeat.count; index += 1) {
      context.onLog({
        level: 'INFO',
        message: `Repeat iteration ${index + 1}/${repeat.count}.`
      })
      if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
        return false
      }

      const nestedSuccess = await context.runNestedCommands(repeat.commands)
      if (!nestedSuccess && context.settings.stopOnError) {
        return false
      }
    }

    context.onLog({
      level: 'INFO',
      message: 'Repeat block finished.'
    })

    return true
  },
  INFINITE_LOOP: async (_command, context) => {
    context.onLog({
      level: 'WARN',
      message: 'Skipped unsupported INFINITE_LOOP.'
    })
    return true
  }
}

export const executeRuntimeCommand = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<boolean> => {
  const commandType = typeof command.type === 'string' ? command.type : undefined
  if (!commandType) {
    throw new Error('Missing command type')
  }

  if (!(commandType in BLOCK_RUNTIME_REGISTRY)) {
    await sleep(context.settings.delayMs)
    return true
  }

  const payload =
    command.payload && typeof command.payload === 'object'
      ? (command.payload as Record<string, unknown>)
      : {}
  BLOCK_REGISTRY_BY_TYPE[commandType as EditorBlockType].payloadSchema.parse(payload)

  const handler = BLOCK_RUNTIME_REGISTRY[commandType as EditorBlockType]
  return handler(command, context)
}
