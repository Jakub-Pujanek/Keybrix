import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ActivityLogSchema,
  coerceAppSettings,
  DashboardStatsSchema,
  IPC_CHANNELS,
  ManualRunReasonCodeSchema,
  MacroStatusChangeEventSchema,
  SystemStatusSchema,
  UpdateAppSettingsInputSchema,
  type ActivityLog,
  type SessionCheckResult,
  type SessionDetectionConfidence,
  type SessionDetectionSource,
  type SessionDiagnostics,
  type ManualRunReasonCode,
  type Macro,
  type KeybrixApi,
  type RuntimeSessionInfo,
  type SessionType
} from '../shared/api'

const MACRO_STATUSES = new Set<Macro['status']>(['RUNNING', 'IDLE', 'ACTIVE', 'PAUSED'])
const MANUAL_RUN_REASON_CODES = new Set<ManualRunReasonCode>(ManualRunReasonCodeSchema.options)
const SESSION_TYPES = new Set<SessionType>(['WAYLAND', 'X11', 'UNKNOWN'])
const SESSION_DETECTION_SOURCES = new Set<SessionDetectionSource>([
  'LOGINCTL',
  'XDG_SESSION_TYPE',
  'DESKTOP_SESSION',
  'XDG_SESSION_DESKTOP',
  'GDMSESSION',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'UNKNOWN'
])
const SESSION_DETECTION_CONFIDENCE = new Set<SessionDetectionConfidence>(['HIGH', 'MEDIUM', 'LOW'])

const isManualRunReasonCode = (value: unknown): value is ManualRunReasonCode => {
  return typeof value === 'string' && MANUAL_RUN_REASON_CODES.has(value as ManualRunReasonCode)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isSessionType = (value: unknown): value is SessionType =>
  typeof value === 'string' && SESSION_TYPES.has(value as SessionType)

const isDetectionSource = (value: unknown): value is SessionDetectionSource =>
  typeof value === 'string' && SESSION_DETECTION_SOURCES.has(value as SessionDetectionSource)

const isDetectionConfidence = (value: unknown): value is SessionDetectionConfidence =>
  typeof value === 'string' && SESSION_DETECTION_CONFIDENCE.has(value as SessionDetectionConfidence)

const coerceRuntimeSessionInfo = (value: unknown): RuntimeSessionInfo => {
  if (!isRecord(value)) {
    throw new Error('Invalid runtime session info payload.')
  }

  const sessionType = value['sessionType']
  const rawSession = value['rawSession']
  const detectedAt = value['detectedAt']
  const isInputInjectionSupported = value['isInputInjectionSupported']
  const detectionSource = value['detectionSource']
  const detectionConfidence = value['detectionConfidence']

  if (!isSessionType(sessionType)) {
    throw new Error('Invalid runtime session type.')
  }
  if (!(rawSession === null || typeof rawSession === 'string')) {
    throw new Error('Invalid runtime rawSession field.')
  }
  if (typeof detectedAt !== 'string' || Number.isNaN(Date.parse(detectedAt))) {
    throw new Error('Invalid runtime detectedAt field.')
  }
  if (typeof isInputInjectionSupported !== 'boolean') {
    throw new Error('Invalid runtime injection support field.')
  }
  if (!isDetectionSource(detectionSource)) {
    throw new Error('Invalid runtime detection source field.')
  }
  if (!isDetectionConfidence(detectionConfidence)) {
    throw new Error('Invalid runtime detection confidence field.')
  }

  return {
    sessionType,
    rawSession,
    detectedAt,
    isInputInjectionSupported,
    detectionSource,
    detectionConfidence
  }
}

const coerceSessionCheckResult = (value: unknown): SessionCheckResult => {
  if (!isRecord(value)) {
    throw new Error('Invalid session check result payload.')
  }

  const previousSessionType = value['previousSessionType']
  const sessionInfo = value['sessionInfo']
  const changed = value['changed']

  if (!isSessionType(previousSessionType)) {
    throw new Error('Invalid previous session type field.')
  }
  if (typeof changed !== 'boolean') {
    throw new Error('Invalid session check changed field.')
  }

  return {
    previousSessionType,
    sessionInfo: coerceRuntimeSessionInfo(sessionInfo),
    changed
  }
}

const coerceSessionDiagnostics = (value: unknown): SessionDiagnostics => {
  if (!isRecord(value)) {
    throw new Error('Invalid session diagnostics payload.')
  }

  const sessionInfo = coerceRuntimeSessionInfo(value['sessionInfo'])
  const snapshot = value['snapshot']
  const probes = value['probes']

  if (!isRecord(snapshot)) {
    throw new Error('Invalid session diagnostics snapshot payload.')
  }

  const asNullableString = (input: unknown): string | null => {
    if (input === null) return null
    if (typeof input === 'string') return input
    throw new Error('Invalid session diagnostics snapshot field.')
  }

  if (!Array.isArray(probes)) {
    throw new Error('Invalid session diagnostics probes payload.')
  }

  const normalizedProbes = probes.map((probe) => {
    if (!isRecord(probe)) {
      throw new Error('Invalid session diagnostics probe entry.')
    }

    const step = probe['step']
    const signal = probe['signal']
    const matched = probe['matched']
    const note = probe['note']

    if (typeof step !== 'string' || step.length === 0) {
      throw new Error('Invalid session diagnostics probe step.')
    }
    if (!(signal === null || typeof signal === 'string')) {
      throw new Error('Invalid session diagnostics probe signal.')
    }
    if (typeof matched !== 'boolean') {
      throw new Error('Invalid session diagnostics probe matched flag.')
    }
    if (typeof note !== 'string' || note.length === 0) {
      throw new Error('Invalid session diagnostics probe note.')
    }

    return { step, signal, matched, note }
  })

  return {
    sessionInfo,
    snapshot: {
      xdgSessionType: asNullableString(snapshot['xdgSessionType']),
      waylandDisplay: asNullableString(snapshot['waylandDisplay']),
      display: asNullableString(snapshot['display']),
      desktopSession: asNullableString(snapshot['desktopSession']),
      xdgSessionDesktop: asNullableString(snapshot['xdgSessionDesktop']),
      gdmSession: asNullableString(snapshot['gdmSession']),
      sessionId: asNullableString(snapshot['sessionId']),
      loginctlSessionType: asNullableString(snapshot['loginctlSessionType'])
    },
    probes: normalizedProbes
  }
}

const coerceMacro = (value: unknown): Macro | null => {
  if (!isRecord(value)) return null

  const id = value['id']
  const name = value['name']
  const description = value['description']
  const shortcut = value['shortcut']
  const isActive = value['isActive']
  const status = value['status']
  const blocksJson = value['blocksJson']

  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof name !== 'string' || name.length === 0) return null
  if (description !== undefined && typeof description !== 'string') return null
  if (typeof shortcut !== 'string') return null
  if (typeof isActive !== 'boolean') return null
  if (typeof status !== 'string' || !MACRO_STATUSES.has(status as Macro['status'])) return null
  if (!isRecord(blocksJson)) return null

  return {
    id,
    name,
    description,
    shortcut,
    isActive,
    status: status as Macro['status'],
    blocksJson
  }
}

const assertMacroId = (id: unknown): string => {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid macro id.')
  }

  return id.trim()
}

const sanitizeSaveInput = (input: unknown): Record<string, unknown> => {
  if (!isRecord(input)) {
    throw new Error('Invalid macro payload.')
  }

  const next: Record<string, unknown> = {}

  if (input['id'] !== undefined) {
    next['id'] = assertMacroId(input['id'])
  }

  if (input['name'] !== undefined) {
    if (typeof input['name'] !== 'string' || input['name'].trim().length === 0) {
      throw new Error('Invalid macro name.')
    }
    next['name'] = input['name'].trim()
  }

  if (input['description'] !== undefined) {
    if (typeof input['description'] !== 'string') {
      throw new Error('Invalid macro description.')
    }
    next['description'] = input['description']
  }

  if (input['shortcut'] !== undefined) {
    if (typeof input['shortcut'] !== 'string' || input['shortcut'].trim().length === 0) {
      throw new Error('Invalid macro shortcut.')
    }
    next['shortcut'] = input['shortcut']
      .trim()
      .replace(/\s*\+\s*/g, '+')
      .toUpperCase()
  }

  if (input['isActive'] !== undefined) {
    if (typeof input['isActive'] !== 'boolean') {
      throw new Error('Invalid macro active state.')
    }
    next['isActive'] = input['isActive']
  }

  if (input['status'] !== undefined) {
    if (
      typeof input['status'] !== 'string' ||
      !MACRO_STATUSES.has(input['status'] as Macro['status'])
    ) {
      throw new Error('Invalid macro status.')
    }
    next['status'] = input['status']
  }

  if (input['blocksJson'] !== undefined) {
    if (!isRecord(input['blocksJson'])) {
      throw new Error('Invalid macro blocks payload.')
    }
    next['blocksJson'] = input['blocksJson']
  }

  return next
}

const api: KeybrixApi = {
  macros: {
    getAll: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.getAll)
      if (!Array.isArray(result)) return []

      const parsed: Macro[] = []
      for (const macro of result) {
        const candidate = coerceMacro(macro)
        if (candidate) {
          parsed.push(candidate)
        }
      }

      if (parsed.length !== result.length) {
        console.warn('[preload] Some macros were dropped due to schema mismatch.')
      }

      return parsed
    },
    getById: async (id) => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.getById, id)
      if (!result) return null

      const macro = coerceMacro(result)
      if (!macro) {
        throw new Error('Invalid macro payload received from main process.')
      }

      return macro
    },
    save: async (input) => {
      const payload = sanitizeSaveInput(input)
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.save, payload)

      const macro = coerceMacro(result)
      if (!macro) {
        throw new Error('Invalid macro payload received from main process.')
      }

      return macro
    },
    delete: async (id) => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.delete, id)
      return Boolean(result)
    },
    toggle: async (id, isActive) => {
      const safeId = assertMacroId(id)
      if (typeof isActive !== 'boolean') {
        throw new Error('Invalid toggle payload.')
      }

      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.toggle, safeId, isActive)
      return Boolean(result)
    },
    runManually: async (id, context) => {
      if (typeof id !== 'string' || id.trim().length === 0) {
        return {
          runId: globalThis.crypto.randomUUID(),
          success: false,
          reasonCode: 'INVALID_MACRO_ID',
          debugMessage: 'run request validation failed in preload bridge'
        }
      }

      const request: { id: string; attemptId?: string } = {
        id: id.trim()
      }
      if (typeof context?.attemptId === 'string' && context.attemptId.trim().length > 0) {
        request.attemptId = context.attemptId.trim()
      }

      try {
        const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.run, request)

        if (typeof result === 'boolean') {
          return {
            runId: globalThis.crypto.randomUUID(),
            success: result,
            reasonCode: result ? 'SUCCESS' : 'RUNNER_FAILED'
          }
        }

        if (isRecord(result)) {
          const runIdCandidate = result['runId']
          const successCandidate = result['success']
          const reasonCandidate = result['reasonCode']
          const debugMessageCandidate = result['debugMessage']

          if (
            typeof runIdCandidate === 'string' &&
            runIdCandidate.trim().length > 0 &&
            typeof successCandidate === 'boolean' &&
            isManualRunReasonCode(reasonCandidate)
          ) {
            return {
              runId: runIdCandidate,
              success: successCandidate,
              reasonCode: reasonCandidate,
              ...(typeof debugMessageCandidate === 'string' && debugMessageCandidate.length > 0
                ? { debugMessage: debugMessageCandidate }
                : {})
            }
          }
        }

        if (isRecord(result)) {
          const runIdCandidate = result['runId']
          const successCandidate = result['success']
          const reasonCandidate = result['reasonCode']

          const runId =
            typeof runIdCandidate === 'string' && runIdCandidate.trim().length > 0
              ? runIdCandidate
              : globalThis.crypto.randomUUID()

          const success = successCandidate === true
          const normalizedReason = isManualRunReasonCode(reasonCandidate)
            ? reasonCandidate
            : success
              ? 'SUCCESS'
              : 'RUNNER_FAILED'

          console.warn('[preload] macros.run returned non-conforming payload; normalized result.', {
            id,
            raw: result,
            normalizedReason
          })

          return {
            runId,
            success,
            reasonCode: normalizedReason
          }
        }

        return {
          runId: globalThis.crypto.randomUUID(),
          success: false,
          reasonCode: 'IPC_ERROR',
          debugMessage: 'macros.run returned non-object payload'
        }
      } catch (error) {
        const debugMessage = error instanceof Error ? error.message : 'unknown ipc bridge error'
        console.error('[preload] macros.run bridge failure', {
          id,
          attemptId: context?.attemptId,
          error,
          debugMessage
        })
        return {
          runId: globalThis.crypto.randomUUID(),
          success: false,
          reasonCode: 'IPC_ERROR',
          debugMessage
        }
      }
    }
  },
  stats: {
    getDashboardStats: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.stats.get)
      return DashboardStatsSchema.parse(result)
    }
  },
  logs: {
    getRecent: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.logs.getRecent)
      if (!Array.isArray(result)) return []

      const parsed: ActivityLog[] = []
      for (const log of result) {
        const entry = ActivityLogSchema.safeParse(log)
        if (entry.success) {
          parsed.push(entry.data)
        }
      }

      if (parsed.length !== result.length) {
        console.warn('[preload] logs.getRecent dropped malformed log entries.', {
          dropped: result.length - parsed.length
        })
      }

      return parsed
    },
    onNewLog: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = ActivityLogSchema.safeParse(payload)
        if (!parsed.success) {
          console.warn('[preload] logs.onNewLog dropped malformed payload.', { payload })
          return
        }

        callback(parsed.data)
      }

      ipcRenderer.on(IPC_CHANNELS.logs.newLog, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.logs.newLog, listener)
      }
    }
  },
  system: {
    getSessionInfo: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.system.getSessionInfo)
      return coerceRuntimeSessionInfo(result)
    },
    getSessionDiagnostics: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.system.getSessionDiagnostics)
      return coerceSessionDiagnostics(result)
    },
    refreshSessionInfo: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.system.refreshSessionInfo)
      return coerceSessionCheckResult(result)
    },
    onStatusUpdate: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = SystemStatusSchema.parse(payload)
        callback(parsed)
      }

      ipcRenderer.on(IPC_CHANNELS.system.statusUpdate, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.system.statusUpdate, listener)
      }
    },
    onMacroStatusChange: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = MacroStatusChangeEventSchema.parse(payload)
        callback(parsed.id, parsed.newStatus)
      }

      ipcRenderer.on(IPC_CHANNELS.system.macroStatusChanged, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.system.macroStatusChanged, listener)
      }
    }
  },
  keyboard: {
    recordShortcut: async (input) => {
      if (!isRecord(input)) {
        throw new Error('Invalid shortcut payload.')
      }

      const keys = input['keys']
      const source = input['source']
      if (typeof keys !== 'string' || keys.trim().length === 0) {
        throw new Error('Invalid shortcut keys.')
      }

      if (source !== 'topbar' && source !== 'start-block' && source !== 'press-key-block') {
        throw new Error('Invalid shortcut source.')
      }

      const result = await ipcRenderer.invoke(IPC_CHANNELS.keyboard.recordShortcut, {
        keys,
        source
      })
      return Boolean(result)
    }
  },
  settings: {
    get: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.settings.get)
      return coerceAppSettings(result)
    },
    update: async (input) => {
      const parsed = UpdateAppSettingsInputSchema.parse(input)
      const result = await ipcRenderer.invoke(IPC_CHANNELS.settings.update, parsed)
      return coerceAppSettings(result)
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore: define in preload dts for non-isolated context
  window.electron = electronAPI
  // @ts-ignore: define in preload dts for non-isolated context
  window.api = api
}
