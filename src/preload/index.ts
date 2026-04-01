import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ActivityLogSchema,
  type DashboardStats,
  DashboardStatsSchema,
  MacroSchema,
  RecordShortcutInputSchema,
  SaveMacroInputSchema,
  SystemStatusSchema,
  ToggleMacroInputSchema,
  type ActivityLog,
  type KeybrixApi,
  type Macro,
  type MacroStatus,
  type SystemStatus
} from '../shared/api'
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

const ensureLogTimer = (): void => {
  if (logTimer || logListeners.size === 0) return

  logTimer = setInterval(() => {
    const samples = [
      "Macro 'Docker Clean' completed stack refresh.",
      'Input detected: [ALT+F2] mapped to automation slot 0x12.',
      'Clipboard watcher passed integrity check.',
      'Background queue synchronized with 0 dropped events.'
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
    getAll: async () => macrosState.map((macro) => MacroSchema.parse({ ...macro })),
    getById: async (id) => {
      const found = macrosState.find((macro) => macro.id === id)
      return found ? MacroSchema.parse({ ...found }) : null
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

      macro.isActive = parsed.isActive
      macro.status = parsed.isActive ? 'ACTIVE' : 'IDLE'
      emitMacroStatus(macro.id, macro.status)
      return true
    },
    runManually: async (id) => {
      const macro = macrosState.find((item) => item.id === id)
      if (!macro) return

      macro.status = 'RUNNING'
      macro.isActive = true
      emitMacroStatus(macro.id, 'RUNNING')

      const runLog = ActivityLogSchema.parse({
        id: `log-run-${Date.now()}`,
        timestamp: timestamp(),
        level: 'RUN',
        message: `Manual run started for '${macro.name}'.`
      })
      logsState.unshift(runLog)
      emitLog(runLog)
    }
  },
  stats: {
    getDashboardStats: async () => buildStats()
  },
  logs: {
    getRecent: async () => logsState.map((log) => ActivityLogSchema.parse(log)),
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

      const shortcutLog = ActivityLogSchema.parse({
        id: `log-shortcut-${Date.now()}`,
        timestamp: timestamp(),
        level: 'INFO',
        message: `Shortcut recorded (${parsed.source}): ${parsed.keys}`
      })

      logsState.unshift(shortcutLog)
      emitLog(shortcutLog)

      return true
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
