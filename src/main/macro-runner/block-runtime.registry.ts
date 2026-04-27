import { Button, Key, keyboard, mouse, Point, straightTo } from '@nut-tree-fork/nut-js'
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

const mouseButtonAliases: Record<string, string> = {
  LEWY: 'LEFT',
  PRAWY: 'RIGHT',
  SRODKOWY: 'MIDDLE',
  SRODKOWYCH: 'MIDDLE'
}

type InputDeviceWithConfig = {
  config?: {
    autoDelayMs?: number
    mouseSpeed?: number
  }
}

const ensureLowLatencyInput = (): void => {
  const keyboardWithConfig = keyboard as unknown as InputDeviceWithConfig
  if (
    keyboardWithConfig.config &&
    typeof keyboardWithConfig.config.autoDelayMs === 'number' &&
    keyboardWithConfig.config.autoDelayMs > 0
  ) {
    keyboardWithConfig.config.autoDelayMs = 0
  }

  const mouseWithConfig = mouse as unknown as InputDeviceWithConfig
  if (
    mouseWithConfig.config &&
    typeof mouseWithConfig.config.autoDelayMs === 'number' &&
    mouseWithConfig.config.autoDelayMs > 0
  ) {
    mouseWithConfig.config.autoDelayMs = 0
  }
}

ensureLowLatencyInput()

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const ABORT_POLL_INTERVAL_MS = 25

const sleepInterruptible = async (
  ms: number,
  context: Pick<RuntimeExecutionContext, 'shouldAbort' | 'isGlobalMasterEnabled'>
): Promise<boolean> => {
  const totalMs = Math.max(0, Math.round(ms))

  if (totalMs === 0) {
    return !context.shouldAbort() && context.isGlobalMasterEnabled()
  }

  let remainingMs = totalMs

  while (remainingMs > 0) {
    if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
      return false
    }

    const nextChunkMs = Math.min(remainingMs, ABORT_POLL_INTERVAL_MS)
    await sleep(nextChunkMs)
    remainingMs -= nextChunkMs
  }

  return !context.shouldAbort() && context.isGlobalMasterEnabled()
}

const delayAfterCommand = async (context: RuntimeExecutionContext): Promise<boolean> => {
  return sleepInterruptible(context.settings.delayMs, context)
}

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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return String(error)
}

const withCommandErrorContext = async <T>(
  operation: () => Promise<T>,
  contextMessage: string
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    throw new Error(`${contextMessage}: ${getErrorMessage(error)}`)
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
  const normalizedInput =
    typeof value === 'string' && value.trim().length > 0
      ? value
          .trim()
          .replace(/^['"`]+|['"`]+$/g, '')
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toUpperCase()
      : 'LEFT'

  const buttonLabel = mouseButtonAliases[normalizedInput] ?? normalizedInput
  const button = mouseButtonMap[buttonLabel]

  if (button === undefined) {
    throw new Error(`Unsupported mouse button '${buttonLabel}'`)
  }

  return {
    label: buttonLabel,
    button
  }
}

const normalizeMouseButtonPayloadValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value
  }

  const normalizedInput = value
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()

  return mouseButtonAliases[normalizedInput] ?? normalizedInput
}

const normalizePayloadForSchemaValidation = (
  commandType: EditorBlockType,
  payload: Record<string, unknown>
): Record<string, unknown> => {
  if (
    commandType === 'MOUSE_CLICK' ||
    commandType === 'AUTOCLICKER_TIMED' ||
    commandType === 'AUTOCLICKER_INFINITE'
  ) {
    return {
      ...payload,
      button: normalizeMouseButtonPayloadValue(payload.button)
    }
  }

  return payload
}

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const asPositiveRoundedIntOr = (value: unknown, fallback: number): number => {
  const numeric = asFiniteNumber(value)
  if (numeric === null) {
    return fallback
  }

  return Math.max(1, Math.round(numeric))
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
    const payload = command.payload as {
      shortcut?: unknown
      key?: unknown
      keys?: unknown
      value?: unknown
    }
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
): Promise<boolean> => {
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
  let keyPressed = false
  let heldToCompletion = false

  try {
    await executeWithTimeout(
      () => keyboard.pressKey(key),
      keyboardTimeoutMs,
      `HOLD_KEY timed out after ${keyboardTimeoutMs}ms while pressing '${token}'.`
    )
    keyPressed = true

    heldToCompletion = await sleepInterruptible(durationMs, context)
  } finally {
    if (keyPressed) {
      await executeWithTimeout(
        () => keyboard.releaseKey(key),
        keyboardTimeoutMs,
        `HOLD_KEY timed out after ${keyboardTimeoutMs}ms while releasing '${token}'.`
      )
    }
  }

  if (!heldToCompletion) {
    context.onLog({
      level: 'WARN',
      message: `Holding key '${token}' interrupted before ${durationMs}ms elapsed.`
    })
    return false
  }

  context.onLog({
    level: 'INFO',
    message: `Held key '${token}' for ${durationMs}ms.`
  })

  return true
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
  const xCandidate = asFiniteNumber(payload.x)
  const yCandidate = asFiniteNumber(payload.y)
  if (xCandidate === null || yCandidate === null) {
    throw new Error('MOUSE_CLICK requires numeric x and y')
  }
  const x = Math.round(xCandidate)
  const y = Math.round(yCandidate)

  const { label: buttonLabel, button } = resolveMouseButton(payload.button)

  context.onLog({
    level: 'RUN',
    message: `Clicking mouse '${buttonLabel}' at (${x}, ${y}).`
  })
  const mouseTimeoutMs = getCommandTimeoutMs('mouse', context.sessionType)
  await executeWithTimeout(
    () =>
      withCommandErrorContext(
        () => mouse.setPosition(new Point(x, y)),
        `MOUSE_CLICK move to (${x}, ${y}) failed`
      ),
    mouseTimeoutMs,
    `MOUSE_CLICK timed out after ${mouseTimeoutMs}ms while moving cursor.`
  )
  await executeWithTimeout(
    () =>
      withCommandErrorContext(
        () => mouse.click(button),
        `MOUSE_CLICK click with button '${buttonLabel}' failed`
      ),
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
): Promise<boolean> => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('AUTOCLICKER_TIMED command is missing payload')
  }

  const payload = command.payload as {
    button?: unknown
    frequencyMs?: unknown
    durationMs?: unknown
  }
  const { label: buttonLabel, button } = resolveMouseButton(payload.button)
  const frequencyMs = asPositiveRoundedIntOr(payload.frequencyMs, 100)
  const durationMs = asPositiveRoundedIntOr(payload.durationMs, 1000)
  const iterations = Math.max(1, Math.floor(durationMs / frequencyMs))
  const mouseTimeoutMs = getCommandTimeoutMs('mouse', context.sessionType)

  context.onLog({
    level: 'RUN',
    message: `Autoclicker timed started (${buttonLabel}, every ${frequencyMs}ms for ${durationMs}ms).`
  })

  for (let index = 0; index < iterations; index += 1) {
    if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
      return false
    }

    await executeWithTimeout(
      () =>
        withCommandErrorContext(
          () => mouse.click(button),
          `AUTOCLICKER_TIMED click with button '${buttonLabel}' failed`
        ),
      mouseTimeoutMs,
      `AUTOCLICKER_TIMED timed out after ${mouseTimeoutMs}ms while clicking '${buttonLabel}'.`
    )

    if (index < iterations - 1) {
      const canContinue = await sleepInterruptible(frequencyMs, context)
      if (!canContinue) {
        return false
      }
    }
  }

  context.onLog({
    level: 'INFO',
    message: `Autoclicker timed finished (${iterations} clicks).`
  })

  return true
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
  const frequencyMs = asPositiveRoundedIntOr(payload.frequencyMs, 100)
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
      return true
    }

    await executeWithTimeout(
      () =>
        withCommandErrorContext(
          () => mouse.click(button),
          `AUTOCLICKER_INFINITE click with button '${buttonLabel}' failed`
        ),
      mouseTimeoutMs,
      `AUTOCLICKER_INFINITE timed out after ${mouseTimeoutMs}ms while clicking '${buttonLabel}'.`
    )

    const canContinue = await sleepInterruptible(frequencyMs, context)
    if (!canContinue) {
      context.onLog({
        level: 'INFO',
        message: 'Autoclicker infinite stopped by abort/global master.'
      })
      return true
    }
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
  const xCandidate = asFiniteNumber(payload.x)
  const yCandidate = asFiniteNumber(payload.y)
  if (xCandidate === null || yCandidate === null) {
    throw new Error('MOVE_MOUSE_DURATION requires numeric x and y')
  }

  const x = Math.round(xCandidate)
  const y = Math.round(yCandidate)
  const durationMs = asPositiveRoundedIntOr(payload.durationMs, 250)

  context.onLog({
    level: 'RUN',
    message: `Moving mouse to (${x}, ${y}) over ${durationMs}ms.`
  })

  const currentPosition = await withCommandErrorContext(
    () => mouse.getPosition(),
    'MOVE_MOUSE_DURATION failed to read current cursor position'
  )

  const distancePx = Math.hypot(x - currentPosition.x, y - currentPosition.y)
  const desiredSpeedPxPerSecond = Math.max(
    1,
    Math.round((distancePx / Math.max(durationMs, 1)) * 1000)
  )
  const mouseWithConfig = mouse as unknown as InputDeviceWithConfig
  const previousSpeed =
    mouseWithConfig.config && typeof mouseWithConfig.config.mouseSpeed === 'number'
      ? mouseWithConfig.config.mouseSpeed
      : undefined

  if (mouseWithConfig.config) {
    mouseWithConfig.config.mouseSpeed = desiredSpeedPxPerSecond
  }

  const mouseTimeoutMs = Math.max(
    getCommandTimeoutMs('mouse', context.sessionType),
    durationMs + 1000
  )
  const moveOperation = async (): Promise<void> => {
    const path = await straightTo(new Point(x, y))
    await mouse.move(path)
  }

  try {
    await executeWithTimeout(
      () =>
        withCommandErrorContext(moveOperation, `MOVE_MOUSE_DURATION move to (${x}, ${y}) failed`),
      mouseTimeoutMs,
      `MOVE_MOUSE_DURATION timed out after ${mouseTimeoutMs}ms while moving cursor.`
    )
  } finally {
    if (mouseWithConfig.config && previousSpeed !== undefined) {
      mouseWithConfig.config.mouseSpeed = previousSpeed
    }
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

const extractLoopCommands = (command: RuntimeCommand): RuntimeCommand[] => {
  if (!command.payload || typeof command.payload !== 'object') {
    throw new Error('Loop command is missing payload')
  }

  const payload = command.payload as { commands?: unknown }
  if (!Array.isArray(payload.commands)) {
    throw new Error('Loop command is missing nested commands array')
  }

  const nestedCommands = payload.commands
    .slice(0, MAX_REPEAT_NESTED_COMMANDS)
    .map((item) => RuntimeCommandSchema.safeParse(item))

  if (nestedCommands.some((item) => !item.success)) {
    throw new Error('Loop command contains invalid nested command payload')
  }

  return nestedCommands
    .filter((item): item is { success: true; data: RuntimeCommand } => item.success)
    .map((item) => item.data)
}

export const BLOCK_RUNTIME_REGISTRY: Readonly<Record<EditorBlockType, RuntimeCommandHandler>> = {
  START: async () => {
    return true
  },
  PRESS_KEY: async (command, context) => {
    await runPressKey(command, context)
    return delayAfterCommand(context)
  },
  HOLD_KEY: async (command, context) => {
    const success = await runHoldKey(command, context)
    if (!success) {
      return false
    }

    return delayAfterCommand(context)
  },
  EXECUTE_SHORTCUT: async (command, context) => {
    await runExecuteShortcut(command, context)
    return delayAfterCommand(context)
  },
  TYPE_TEXT: async (command, context) => {
    await runTypeText(command, context)
    return delayAfterCommand(context)
  },
  MOUSE_CLICK: async (command, context) => {
    await runMouseClick(command, context)
    return delayAfterCommand(context)
  },
  AUTOCLICKER_TIMED: async (command, context) => {
    const success = await runAutoclickerTimed(command, context)
    if (!success) {
      return false
    }

    return delayAfterCommand(context)
  },
  AUTOCLICKER_INFINITE: async (command, context) => {
    return runAutoclickerInfinite(command, context)
  },
  MOVE_MOUSE_DURATION: async (command, context) => {
    await runMoveMouseDuration(command, context)
    return delayAfterCommand(context)
  },
  WAIT: async (command, context) => {
    const waitMs = resolveWaitDuration(command, context.settings.delayMs)
    context.onLog({
      level: 'RUN',
      message: `Waiting ${waitMs}ms.`
    })

    const completed = await sleepInterruptible(waitMs, context)
    if (!completed) {
      context.onLog({
        level: 'WARN',
        message: `Wait interrupted after ${waitMs}ms request.`
      })
      return false
    }

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
  INFINITE_LOOP: async (command, context) => {
    const commands = extractLoopCommands(command)
    context.onLog({
      level: 'RUN',
      message: 'Starting infinite loop block.'
    })

    let iteration = 0
    while (true) {
      if (context.shouldAbort() || !context.isGlobalMasterEnabled()) {
        context.onLog({
          level: 'WARN',
          message: `Infinite loop stopped after ${iteration} iterations.`
        })
        return false
      }

      iteration += 1
      context.onLog({
        level: 'INFO',
        message: `Infinite loop iteration ${iteration}.`
      })

      const nestedSuccess = await context.runNestedCommands(commands)
      if (!nestedSuccess && context.settings.stopOnError) {
        return false
      }

      if (commands.length === 0) {
        const canContinue = await sleepInterruptible(Math.max(0, context.settings.delayMs), context)
        if (!canContinue) {
          context.onLog({
            level: 'WARN',
            message: `Infinite loop stopped after ${iteration} iterations.`
          })
          return false
        }
      }
    }
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
    return sleepInterruptible(context.settings.delayMs, context)
  }

  const payload =
    command.payload && typeof command.payload === 'object'
      ? (command.payload as Record<string, unknown>)
      : {}
  const payloadForValidation = normalizePayloadForSchemaValidation(
    commandType as EditorBlockType,
    payload
  )
  BLOCK_REGISTRY_BY_TYPE[commandType as EditorBlockType].payloadSchema.parse(payloadForValidation)

  const handler = BLOCK_RUNTIME_REGISTRY[commandType as EditorBlockType]
  return handler(command, context)
}
