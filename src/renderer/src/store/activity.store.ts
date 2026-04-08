import { create } from 'zustand'
import type { ActivityLog } from '../../../shared/api'

type ActivityState = {
  logs: ActivityLog[]
  isLoading: boolean
  loadRecentLogs: () => Promise<ActivityLog[]>
  subscribeRealtimeLogs: () => () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  logs: [],
  isLoading: false,
  loadRecentLogs: async () => {
    set({ isLoading: true })
    const logs = await window.api.logs.getRecent()
    set({ logs, isLoading: false })
    return logs
  },
  subscribeRealtimeLogs: () => {
    const off = window.api.logs.onNewLog((nextLog) => {
      set((state) => ({
        logs: [nextLog, ...state.logs].slice(0, 40)
      }))
    })

    return () => off()
  }
}))
