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

const resolveMouseButton = (value: unknown): { label: string; button: Button } => {
  const buttonLabel =
    typeof value === 'string' && value.trim().length > 0 ? value.toUpperCase() : 'LEFT'
  const button = mouseButtonMap[buttonLabel]

  if (!button) {
    throw new Error(`Unsupported mouse button '${buttonLabel}'`)
  }

  return {
    label: buttonLabel,
    button
  }
}

const extractSingleKeyToken = (command: RuntimeCommand, commandType: string): string => {
  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { key?: unknown; keys?: unknown; value?: unknown }
    const source = [payload.key, payload.keys, payload.value].find(
      (item) => typeof item === 'string' && item.trim().length > 0
    )

    if (typeof source === 'string') {
      const normalized = source
        .split('+')
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)

      if (normalized.length > 0) {
        return normalized[normalized.length - 1] ?? ''
      }
    }
  }

  throw new Error(`${commandType} command is missing single key payload`)
}

const extractShortcutTokens = (command: RuntimeCommand): string[] => {
  if (command.payload && typeof command.payload === 'object') {
    const payload = command.payload as { shortcut?: unknown; key?: unknown; keys?: unknown; value?: unknown }
    const source = [payload.shortcut, payload.key, payload.keys, payload.value].find(
      (item) => typeof item === 'string' && item.trim().length > 0
    )

    if (typeof source === 'string') {
      return source.split('+').map((chunk) => chunk.trim())
    }
  }

  throw new Error('EXECUTE_SHORTCUT command is missing shortcut payload')
}

const runPressKey = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  const token = extractSingleKeyToken(command, 'PRESS_KEY')
  const key = resolveKey(token)

  context.onLog({
    level: 'RUN',
    message: `Pressing single key: ${token}.`
  })
  const keyboardTimeoutMs = getCommandTimeoutMs('keyboard', context.sessionType)
  await executeWithTimeout(
    () => keyboard.pressKey(key),
    keyboardTimeoutMs,
    `PRESS_KEY timed out after ${keyboardTimeoutMs}ms while pressing '${token}'.`
  )
  await executeWithTimeout(
    () => keyboard.releaseKey(key),
    keyboardTimeoutMs,
    `PRESS_KEY timed out after ${keyboardTimeoutMs}ms while releasing '${token}'.`
  )
  context.onLog({
    level: 'INFO',
    message: `Pressed single key: ${token}.`
  })
}

const runHoldKey = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  const token = extractSingleKeyToken(command, 'HOLD_KEY')
  const key = resolveKey(token)

  const payload = command.payload as { durationMs?: unknown }
  const durationMs =
    typeof payload.durationMs === 'number' ? Math.max(1, Math.round(payload.durationMs)) : 300

  context.onLog({
    level: 'RUN',
    message: `Holding key '${token}' for ${durationMs}ms.`
  })
  const keyboardTimeoutMs = getCommandTimeoutMs('keyboard', context.sessionType)
  await executeWithTimeout(
    () => keyboard.pressKey(key),
    keyboardTimeoutMs,
    `HOLD_KEY timed out after ${keyboardTimeoutMs}ms while pressing '${token}'.`
  )
  await sleep(durationMs)
  await executeWithTimeout(
    () => keyboard.releaseKey(key),
    keyboardTimeoutMs,
    `HOLD_KEY timed out after ${keyboardTimeoutMs}ms while releasing '${token}'.`
  )
  context.onLog({
    level: 'INFO',
    message: `Held key '${token}' for ${durationMs}ms.`
  })
}

const runExecuteShortcut = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  const tokens = extractShortcutTokens(command)
  const keys = tokens.map((token) => resolveKey(token))

  if (keys.length === 0) {
    throw new Error('EXECUTE_SHORTCUT command has no keys to press')
  }

  context.onLog({
    level: 'RUN',
    message: `Executing shortcut: ${tokens.join(' + ')}.`
  })
  const keyboardTimeoutMs = getCommandTimeoutMs('keyboard', context.sessionType)
  await executeWithTimeout(
    () => keyboard.pressKey(...keys),
    keyboardTimeoutMs,
    `EXECUTE_SHORTCUT timed out after ${keyboardTimeoutMs}ms while pressing '${tokens.join(' + ')}'.`
  )
  await executeWithTimeout(
    () => keyboard.releaseKey(...keys.reverse()),
    keyboardTimeoutMs,
    `EXECUTE_SHORTCUT timed out after ${keyboardTimeoutMs}ms while releasing '${tokens.join(' + ')}'.`
  )
  context.onLog({
    level: 'INFO',
    message: `Executed shortcut: ${tokens.join(' + ')}.`
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

  const { label: buttonLabel, button } = resolveMouseButton(payload.button)

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

const runAutoclickerTimed = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('AUTOCLICKER_TIMED command is missing payload')
  }

  const payload = command.payload as { button?: unknown; frequencyMs?: unknown; durationMs?: unknown }
  const { label: buttonLabel, button } = resolveMouseButton(payload.button)
  const frequencyMs =
    typeof payload.frequencyMs === 'number' ? Math.max(1, Math.round(payload.frequencyMs)) : 100
  const durationMs =
    typeof payload.durationMs === 'number' ? Math.max(1, Math.round(payload.durationMs)) : 1000
  const iterations = Math.max(1, Math.floor(durationMs / frequencyMs))
  const mouseTimeoutMs = getCommandTimeoutMs('mouse', context.sessionType)

  context.onLog({
    level: 'RUN',
    message: `Autoclicker timed started (${buttonLabel}, every ${frequencyMs}ms for ${durationMs}ms).`
  })

  for (let index = 0; index < iterations; index += 1) {
    if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
      return
    }

    await executeWithTimeout(
      () => mouse.click(button),
      mouseTimeoutMs,
      `AUTOCLICKER_TIMED timed out after ${mouseTimeoutMs}ms while clicking '${buttonLabel}'.`
    )

    if (index < iterations - 1) {
      await sleep(frequencyMs)
    }
  }

  context.onLog({
    level: 'INFO',
    message: `Autoclicker timed finished (${iterations} clicks).`
  })
}

const runAutoclickerInfinite = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<boolean> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('AUTOCLICKER_INFINITE command is missing payload')
  }

  const payload = command.payload as { button?: unknown; frequencyMs?: unknown }
  const { label: buttonLabel, button } = resolveMouseButton(payload.button)
  const frequencyMs =
    typeof payload.frequencyMs === 'number' ? Math.max(1, Math.round(payload.frequencyMs)) : 100
  const mouseTimeoutMs = getCommandTimeoutMs('mouse', context.sessionType)

  context.onLog({
    level: 'RUN',
    message: `Autoclicker infinite started (${buttonLabel}, every ${frequencyMs}ms).`
  })

  while (true) {
    if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
      context.onLog({
        level: 'INFO',
        message: 'Autoclicker infinite stopped by abort/global master.'
      })
      return false
    }

    await executeWithTimeout(
      () => mouse.click(button),
      mouseTimeoutMs,
      `AUTOCLICKER_INFINITE timed out after ${mouseTimeoutMs}ms while clicking '${buttonLabel}'.`
    )
    await sleep(frequencyMs)
  }
}

const runMoveMouseDuration = async (
  command: RuntimeCommand,
  context: RuntimeExecutionContext
): Promise<void> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('MOVE_MOUSE_DURATION command is missing payload')
  }

  const payload = command.payload as { x?: unknown; y?: unknown; durationMs?: unknown }
  if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
    throw new Error('MOVE_MOUSE_DURATION requires numeric x and y')
  }

  const x = Math.round(payload.x)
  const y = Math.round(payload.y)
  const durationMs =
    typeof payload.durationMs === 'number' ? Math.max(1, Math.round(payload.durationMs)) : 250

  context.onLog({
    level: 'RUN',
    message: `Moving mouse to (${x}, ${y}) over ${durationMs}ms.`
  })

  const mouseTimeoutMs = Math.max(getCommandTimeoutMs('mouse', context.sessionType), durationMs + 250)
  await executeWithTimeout(
    () => mouse.setPosition(new Point(x, y)),
    mouseTimeoutMs,
    `MOVE_MOUSE_DURATION timed out after ${mouseTimeoutMs}ms while moving cursor.`
  )

  if (durationMs > 1) {
    await sleep(durationMs)
  }

  context.onLog({
    level: 'INFO',
    message: `Mouse moved to (${x}, ${y}).`
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
  HOLD_KEY: async (command, context) => {
    await runHoldKey(command, context)
    await sleep(context.settings.delayMs)
    return true
  },
  EXECUTE_SHORTCUT: async (command, context) => {
    await runExecuteShortcut(command, context)
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
  AUTOCLICKER_TIMED: async (command, context) => {
    await runAutoclickerTimed(command, context)
    await sleep(context.settings.delayMs)
    return true
  },
  AUTOCLICKER_INFINITE: async (command, context) => {
    return runAutoclickerInfinite(command, context)
  },
  MOVE_MOUSE_DURATION: async (command, context) => {
    await runMoveMouseDuration(command, context)
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
