import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ActivityLogSchema,
  coerceAppSettings,
  DashboardStatsSchema,
  IPC_CHANNELS,
  MacroSchema,
  MacroStatusChangeEventSchema,
  RecordShortcutInputSchema,
  SaveMacroInputSchema,
  SystemStatusSchema,
  ToggleMacroInputSchema,
  UpdateAppSettingsInputSchema,
  type KeybrixApi
} from '../shared/api'

const api: KeybrixApi = {
  macros: {
    getAll: async () => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.getAll)
      if (!Array.isArray(result)) return []
      return result.map((macro) => MacroSchema.parse(macro))
    },
    getById: async (id) => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.getById, id)
      if (!result) return null
      return MacroSchema.parse(result)
    },
    save: async (input) => {
      const parsed = SaveMacroInputSchema.parse(input)
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.save, parsed)
      return MacroSchema.parse(result)
    },
    delete: async (id) => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.macros.delete, id)
      return Boolean(result)
    },
    toggle: async (id, isActive) => {
      const parsed = ToggleMacroInputSchema.parse({ id, isActive })
      const result = await ipcRenderer.invoke(
        IPC_CHANNELS.macros.toggle,
        parsed.id,
        parsed.isActive
      )
      return Boolean(result)
    },
    runManually: async (id) => {
      await ipcRenderer.invoke(IPC_CHANNELS.macros.run, id)
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
      return result.map((log) => ActivityLogSchema.parse(log))
    },
    onNewLog: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = ActivityLogSchema.parse(payload)
        callback(parsed)
      }

      ipcRenderer.on(IPC_CHANNELS.logs.newLog, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.logs.newLog, listener)
      }
    }
  },
  system: {
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
      const parsed = RecordShortcutInputSchema.parse(input)
      const result = await ipcRenderer.invoke(IPC_CHANNELS.keyboard.recordShortcut, parsed)
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
