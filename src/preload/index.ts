import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { z } from 'zod'
import {
  ActivityLogSchema,
  DashboardStatsSchema,
  IPC_CHANNELS,
  MacroSchema,
  MacroStatusChangeEventSchema,
  SaveMacroInputSchema,
  SystemStatusSchema,
  ToggleMacroInputSchema,
  type KeybrixApi
} from '../shared/api'

// Custom APIs for renderer
const api: KeybrixApi = {
  macros: {
    getAll: async () => {
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.macros.getAll)
      return z.array(MacroSchema).parse(payload)
    },
    getById: async (id) => {
      const macroId = z.string().min(1).parse(id)
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.macros.getById, macroId)
      return payload ? MacroSchema.parse(payload) : null
    },
    save: async (macro) => {
      const input = SaveMacroInputSchema.parse(macro)
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.macros.save, input)
      return MacroSchema.parse(payload)
    },
    delete: async (id) => {
      const macroId = z.string().min(1).parse(id)
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.macros.delete, macroId)
      return z.boolean().parse(payload)
    },
    toggle: async (id, isActive) => {
      const input = ToggleMacroInputSchema.parse({ id, isActive })
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.macros.toggle, input)
      return z.boolean().parse(payload)
    },
    runManually: async (id) => {
      const macroId = z.string().min(1).parse(id)
      await ipcRenderer.invoke(IPC_CHANNELS.macros.run, macroId)
    }
  },
  stats: {
    getDashboardStats: async () => {
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.stats.get)
      return DashboardStatsSchema.parse(payload)
    }
  },
  logs: {
    getRecent: async () => {
      const payload = await ipcRenderer.invoke(IPC_CHANNELS.logs.getRecent)
      return z.array(ActivityLogSchema).parse(payload)
    },
    onNewLog: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = ActivityLogSchema.safeParse(payload)
        if (!parsed.success) return
        callback(parsed.data)
      }

      ipcRenderer.on(IPC_CHANNELS.logs.newLog, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.logs.newLog, listener)
    }
  },
  system: {
    onStatusUpdate: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = SystemStatusSchema.safeParse(payload)
        if (!parsed.success) return
        callback(parsed.data)
      }

      ipcRenderer.on(IPC_CHANNELS.system.statusUpdate, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.system.statusUpdate, listener)
    },
    onMacroStatusChange: (callback) => {
      const listener = (_event: unknown, payload: unknown): void => {
        const parsed = MacroStatusChangeEventSchema.safeParse(payload)
        if (!parsed.success) return
        callback(parsed.data.id, parsed.data.newStatus)
      }

      ipcRenderer.on(IPC_CHANNELS.system.macroStatusChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.system.macroStatusChanged, listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
