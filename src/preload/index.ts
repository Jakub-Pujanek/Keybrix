import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ActivityLogSchema,
  DEFAULT_APP_SETTINGS,
  coerceAppSettings,
  type DashboardStats,
  DashboardStatsSchema,
  IPC_CHANNELS,
  MacroSchema,
  RecordShortcutInputSchema,
  SaveMacroInputSchema,
  UpdateAppSettingsInputSchema,
  SystemStatusSchema,
  ToggleMacroInputSchema,
  type ActivityLog,
  type AppSettings,
  type KeybrixApi,
  type Macro,
  type MacroStatus,
  type SystemStatus
} from '../shared/api'
import { t, type I18nPathKey, type Language } from '../shared/i18n'
import { MOCK_BASE_STATS, MOCK_LOGS, MOCK_MACROS } from '../main/store/mockData'

const macrosState: Macro[] = MOCK_MACROS.map((macro) => ({
  ...macro,
  blocksJson: { ...macro.blocksJson }
}))

const logsState: ActivityLog[] = [...MOCK_LOGS]

const logListeners = new Set<(log: ActivityLog) => void>()
const statusListeners = new Set<(status: SystemStatus) => void>()
const macroStatusListeners = new Set<(id: string, newStatus: MacroStatus) => void>()

let logTimer: ReturnType<typeof setInterval> | undefined
let statusTimer: ReturnType<typeof setInterval> | undefined
let macroTimer: ReturnType<typeof setInterval> | undefined

const statusCycle: MacroStatus[] = ['RUNNING', 'ACTIVE', 'IDLE', 'PAUSED']

type MacroCommand = {
  type?: unknown
  ms?: unknown
}

const macroLocalizationKeys: Record<
  string,
  {
    name: I18nPathKey
    description: I18nPathKey
  }
> = {
  'macro-copy-paste-pro': {
    name: 'mock.macros.macro-copy-paste-pro.name',
    description: 'mock.macros.macro-copy-paste-pro.description'
  },
  'macro-open-browser': {
    name: 'mock.macros.macro-open-browser.name',
    description: 'mock.macros.macro-open-browser.description'
  },
  'macro-type-signature': {
    name: 'mock.macros.macro-type-signature.name',
    description: 'mock.macros.macro-type-signature.description'
  },
  'macro-screenshot-save': {
    name: 'mock.macros.macro-screenshot-save.name',
    description: 'mock.macros.macro-screenshot-save.description'
  },
  'macro-docker-clean': {
    name: 'mock.macros.macro-docker-clean.name',
    description: 'mock.macros.macro-docker-clean.description'
  }
}

const logLocalizationKeys: Record<string, I18nPathKey> = {
  'log-1': 'mock.logs.log-1',
  'log-2': 'mock.logs.log-2',
  'log-3': 'mock.logs.log-3',
  'log-4': 'mock.logs.log-4'
}

const resolveLanguage = async (): Promise<Language> => {
  try {
    const settingsRaw = await ipcRenderer.invoke(IPC_CHANNELS.settings.get)
    return coerceAppSettings(settingsRaw).language
  } catch {
    return 'POLSKI'
  }
}

const resolveSettings = async (): Promise<AppSettings> => {
  try {
    const settingsRaw = await ipcRenderer.invoke(IPC_CHANNELS.settings.get)
    return coerceAppSettings(settingsRaw)
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const createRuntimeLog = (input: Pick<ActivityLog, 'level' | 'message'>): ActivityLog =>
  ActivityLogSchema.parse({
    id: `log-runtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: timestamp(),
    ...input
  })

const localizeMacro = (macro: Macro, language: Language): Macro => {
  const keys = macroLocalizationKeys[macro.id]
  if (!keys) return macro

  return {
    ...macro,
    name: t(language, keys.name),
    description: t(language, keys.description)
  }
}

const localizeLog = (log: ActivityLog, language: Language): ActivityLog => {
  const key = logLocalizationKeys[log.id]
  if (!key) return log

  const macroName =
    log.id === 'log-1' ? t(language, 'mock.macros.macro-copy-paste-pro.name') : undefined

  return {
    ...log,
    message: t(language, key, {
      macroName
    })
  }
}

const timestamp = (): string => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `[${hh}:${mm}:${ss}]`
}

const emitLog = (log: ActivityLog): void => {
  for (const listener of logListeners) listener(log)
}

const emitSystemStatus = (status: SystemStatus): void => {
  for (const listener of statusListeners) listener(status)
}

const emitMacroStatus = (id: string, newStatus: MacroStatus): void => {
  for (const listener of macroStatusListeners) listener(id, newStatus)
}

const buildStats = (): DashboardStats => {
  const totalAutomations = macrosState.length
  const activeNow = macrosState.filter((macro) => macro.isActive).length
  const successRate = (MOCK_BASE_STATS.successfulRuns / MOCK_BASE_STATS.totalRuns) * 100

  return DashboardStatsSchema.parse({
    totalAutomations,
    timeSavedMinutes: MOCK_BASE_STATS.timeSavedMinutes,
    successRate,
    activeNow
  })
}

const deactivateAllMacros = (): void => {
  for (const macro of macrosState) {
    if (!macro.isActive && macro.status === 'IDLE') continue

    macro.isActive = false
    macro.status = 'IDLE'
    emitMacroStatus(macro.id, 'IDLE')
  }
}

const getMacroCommands = (macro: Macro): MacroCommand[] => {
  const raw = macro.blocksJson['commands']
  if (!Array.isArray(raw)) return []
  return raw as MacroCommand[]
}

const ensureLogTimer = (): void => {
  if (logTimer || logListeners.size === 0) return

  logTimer = setInterval(() => {
    void (async () => {
      const language = await resolveLanguage()
      const samples = [
        t(language, 'runtime.samples.dockerCleanCompleted'),
        t(language, 'runtime.samples.inputDetected'),
        t(language, 'runtime.samples.clipboardIntegrity'),
        t(language, 'runtime.samples.queueSynced')
      ]

      const levels: Array<'RUN' | 'TRIG' | 'INFO'> = ['RUN', 'TRIG', 'INFO']
      const nextLog = ActivityLogSchema.parse({
        id: `log-${Date.now()}`,
        timestamp: timestamp(),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: samples[Math.floor(Math.random() * samples.length)]
      })

      logsState.unshift(nextLog)
      if (logsState.length > 40) logsState.length = 40
      emitLog(nextLog)
    })()
  }, 7000)
}

const ensureStatusTimer = (): void => {
  if (statusTimer || statusListeners.size === 0) return

  statusTimer = setInterval(() => {
    const status = Math.random() > 0.12 ? 'OPTIMAL' : 'DEGRADED'
    emitSystemStatus(SystemStatusSchema.parse(status))
  }, 12000)
}

const ensureMacroTimer = (): void => {
  if (macroTimer || macroStatusListeners.size === 0) return

  macroTimer = setInterval(() => {
    if (macrosState.length === 0) return

    const macro = macrosState[Math.floor(Math.random() * macrosState.length)]
    const nextStatus = statusCycle[Math.floor(Math.random() * statusCycle.length)]

    macro.status = nextStatus
    macro.isActive = nextStatus === 'RUNNING' || nextStatus === 'ACTIVE'
    emitMacroStatus(macro.id, nextStatus)
  }, 10000)
}

const cleanupIfUnused = (): void => {
  if (logListeners.size === 0 && logTimer) {
    clearInterval(logTimer)
    logTimer = undefined
  }

  if (statusListeners.size === 0 && statusTimer) {
    clearInterval(statusTimer)
    statusTimer = undefined
  }

  if (macroStatusListeners.size === 0 && macroTimer) {
    clearInterval(macroTimer)
    macroTimer = undefined
  }
}

const api: KeybrixApi = {
  macros: {
    getAll: async () => {
      const language = await resolveLanguage()
      return macrosState.map((macro) => MacroSchema.parse(localizeMacro({ ...macro }, language)))
    },
    getById: async (id) => {
      const language = await resolveLanguage()
      const found = macrosState.find((macro) => macro.id === id)
      return found ? MacroSchema.parse(localizeMacro({ ...found }, language)) : null
    },
    save: async (input) => {
      const parsed = SaveMacroInputSchema.parse(input)
      const existing = parsed.id ? macrosState.find((item) => item.id === parsed.id) : undefined

      if (existing) {
        const nextMacro = MacroSchema.parse({
          ...existing,
          ...parsed,
          id: existing.id
        })
        Object.assign(existing, nextMacro)
        return nextMacro
      }

      const created = MacroSchema.parse({
        id: parsed.id ?? `macro-${Date.now()}`,
        name: parsed.name ?? 'Untitled Macro',
        description: parsed.description,
        shortcut: parsed.shortcut ?? 'UNASSIGNED',
        isActive: parsed.isActive ?? false,
        status: parsed.status ?? 'IDLE',
        blocksJson: parsed.blocksJson ?? { commands: [] }
      })

      macrosState.unshift(created)
      return created
    },
    delete: async (id) => {
      const before = macrosState.length
      const next = macrosState.filter((macro) => macro.id !== id)
      macrosState.length = 0
      macrosState.push(...next)
      return before !== macrosState.length
    },
    toggle: async (id, isActive) => {
      const parsed = ToggleMacroInputSchema.parse({ id, isActive })
      const macro = macrosState.find((item) => item.id === parsed.id)
      if (!macro) return false

      if (parsed.isActive) {
        const settings = await resolveSettings()
        if (!settings.globalMaster) {
          const language = settings.language
          const blockedLog = createRuntimeLog({
            level: 'WARN',
            message: t(language, 'runtime.globalMasterBlockedToggle', {
              macroName: localizeMacro(macro, language).name
            })
          })

          logsState.unshift(blockedLog)
          emitLog(blockedLog)
          return false
        }
      }

      macro.isActive = parsed.isActive
      macro.status = parsed.isActive ? 'ACTIVE' : 'IDLE'
      emitMacroStatus(macro.id, macro.status)
      return true
    },
    runManually: async (id) => {
      const macro = macrosState.find((item) => item.id === id)
      if (!macro) return

      const settings = await resolveSettings()
      const language = settings.language
      const localizedMacroName = localizeMacro(macro, language).name

      if (!settings.globalMaster) {
        const blockedLog = createRuntimeLog({
          level: 'WARN',
          message: t(language, 'runtime.globalMasterBlockedRun', {
            macroName: localizedMacroName
          })
        })
        logsState.unshift(blockedLog)
        emitLog(blockedLog)
        return
      }

      macro.status = 'RUNNING'
      macro.isActive = true
      emitMacroStatus(macro.id, 'RUNNING')

      const runLog = ActivityLogSchema.parse({
        id: `log-run-${Date.now()}`,
        timestamp: timestamp(),
        level: 'RUN',
        message: t(language, 'runtime.manualRunStarted', {
          macroName: localizedMacroName
        })
      })
      logsState.unshift(runLog)
      emitLog(runLog)

      const commands = getMacroCommands(macro)
      const defaultDelayMs = settings.delayMs

      for (const command of commands) {
        try {
          const commandType = typeof command?.type === 'string' ? command.type : undefined
          if (!commandType) {
            throw new Error('Missing command type')
          }

          if (commandType === 'WAIT') {
            const waitMsRaw = typeof command.ms === 'number' ? command.ms : defaultDelayMs
            const waitMs = Math.max(0, Math.round(waitMsRaw))
            await sleep(waitMs)
            continue
          }

          if (commandType === 'INFINITE_LOOP') {
            const unsupportedLog = createRuntimeLog({
              level: 'WARN',
              message: t(language, 'runtime.commandInfiniteLoopSkipped', {
                macroName: localizedMacroName
              })
            })
            logsState.unshift(unsupportedLog)
            emitLog(unsupportedLog)
            continue
          }

          await sleep(defaultDelayMs)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          const errorLog = createRuntimeLog({
            level: 'ERR',
            message: t(language, 'runtime.commandExecutionFailed', {
              macroName: localizedMacroName,
              reason: errorMessage
            })
          })
          logsState.unshift(errorLog)
          emitLog(errorLog)

          if (settings.stopOnError) {
            macro.status = 'IDLE'
            macro.isActive = false
            emitMacroStatus(macro.id, 'IDLE')
            return
          }
        }
      }

      macro.status = 'ACTIVE'
      macro.isActive = true
      emitMacroStatus(macro.id, 'ACTIVE')

      await ipcRenderer
        .invoke(IPC_CHANNELS.notifications.macroRun, { macroName: localizedMacroName })
        .catch(() => undefined)
    }
  },
  stats: {
    getDashboardStats: async () => buildStats()
  },
  logs: {
    getRecent: async () => {
      const language = await resolveLanguage()
      return logsState.map((log) => ActivityLogSchema.parse(localizeLog(log, language)))
    },
    onNewLog: (callback) => {
      logListeners.add(callback)
      ensureLogTimer()

      return () => {
        logListeners.delete(callback)
        cleanupIfUnused()
      }
    }
  },
  system: {
    onStatusUpdate: (callback) => {
      statusListeners.add(callback)
      callback('OPTIMAL')
      ensureStatusTimer()

      return () => {
        statusListeners.delete(callback)
        cleanupIfUnused()
      }
    },
    onMacroStatusChange: (callback) => {
      macroStatusListeners.add(callback)
      ensureMacroTimer()

      return () => {
        macroStatusListeners.delete(callback)
        cleanupIfUnused()
      }
    }
  },
  keyboard: {
    recordShortcut: async (input) => {
      const parsed = RecordShortcutInputSchema.parse(input)
      const language = await resolveLanguage()

      const shortcutLog = ActivityLogSchema.parse({
        id: `log-shortcut-${Date.now()}`,
        timestamp: timestamp(),
        level: 'INFO',
        message: t(language, 'runtime.shortcutRecorded', {
          source: parsed.source,
          keys: parsed.keys
        })
      })

      logsState.unshift(shortcutLog)
      emitLog(shortcutLog)

      return true
    }
  },
  settings: {
    get: async () => {
      try {
        const result = await ipcRenderer.invoke(IPC_CHANNELS.settings.get)
        const parsed = coerceAppSettings(result)
        return parsed
      } catch (error) {
        console.error('[settings][preload] get failed:', error)
        throw error
      }
    },
    update: async (input) => {
      try {
        const parsed = UpdateAppSettingsInputSchema.parse(input)
        const result = await ipcRenderer.invoke(IPC_CHANNELS.settings.update, parsed)
        const next = coerceAppSettings(result)

        if (parsed.globalMaster === false) {
          deactivateAllMacros()

          const masterOffLog = createRuntimeLog({
            level: 'WARN',
            message: t(next.language, 'runtime.globalMasterDisabledAll')
          })
          logsState.unshift(masterOffLog)
          emitLog(masterOffLog)
        }

        return next
      } catch (error) {
        console.error('[settings][preload] update failed:', error, input)
        throw error
      }
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
