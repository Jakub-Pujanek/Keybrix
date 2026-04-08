import { create } from 'zustand'
import type { DashboardStats, SystemStatus } from '../../../shared/api'

type ScreenName = 'dashboard' | 'editor' | 'settings' | 'wayland-guide'

type AppState = {
  activeScreen: ScreenName
  systemStatus: SystemStatus
  dashboardStats: DashboardStats | null
  setActiveScreen: (screen: ScreenName) => void
  loadDashboardStats: () => Promise<void>
  subscribeSystemStatus: () => () => void
}

export const useAppStore = create<AppState>((set) => ({
  activeScreen: 'dashboard',
  systemStatus: 'OPTIMAL',
  dashboardStats: null,
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  loadDashboardStats: async () => {
    const stats = await window.api.stats.getDashboardStats()
    set({ dashboardStats: stats })
  },
  subscribeSystemStatus: () => {
    const off = window.api.system.onStatusUpdate((status) => {
      set({ systemStatus: status })
    })

    return () => off()
  }
}))
