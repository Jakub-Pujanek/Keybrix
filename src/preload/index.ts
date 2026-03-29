import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { KeybrixApi } from '../shared/api'

const api: KeybrixApi = {
  macros: {
    getAll: async () => [],
    getById: async () => null,
    save: async () => {
      throw new Error('Not implemented')
    },
    delete: async () => false,
    toggle: async () => false,
    runManually: async () => {}
  },
  stats: {
    getDashboardStats: async () => ({
      totalAutomations: 0,
      timeSavedMinutes: 0,
      successRate: 100,
      activeNow: 0
    })
  },
  logs: {
    getRecent: async () => [],
    onNewLog: () => () => {}
  },
  system: {
    onStatusUpdate: () => () => {},
    onMacroStatusChange: () => () => {}
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
