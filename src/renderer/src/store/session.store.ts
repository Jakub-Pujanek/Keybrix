import { create } from 'zustand'
import type { RuntimeSessionInfo } from '../../../shared/api'
import { useAppStore } from './app.store'

type AppScreen = ReturnType<typeof useAppStore.getState>['activeScreen']

const SUCCESS_BANNER_TTL_MS = 5000

type SessionState = {
  sessionInfo: RuntimeSessionInfo | null
  isChecking: boolean
  lastBlockedAt: string | null
  showSuccessUntil: number | null
  guideReturnScreen: AppScreen | null
  loadSessionInfo: () => Promise<void>
  refreshSessionInfo: () => Promise<void>
  openWaylandGuide: () => void
  closeWaylandGuide: () => void
  consumeSuccessAutohide: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionInfo: null,
  isChecking: false,
  lastBlockedAt: null,
  showSuccessUntil: null,
  guideReturnScreen: null,
  loadSessionInfo: async () => {
    try {
      const sessionInfo = await window.api.system.getSessionInfo()

      set((state) => ({
        sessionInfo,
        lastBlockedAt:
          sessionInfo.sessionType === 'WAYLAND'
            ? (state.lastBlockedAt ?? sessionInfo.detectedAt)
            : null
      }))
    } catch (error) {
      console.error('[session.store] loadSessionInfo failed:', error)
      const fallbackDetectedAt = new Date().toISOString()

      set({
        sessionInfo: {
          sessionType: 'UNKNOWN',
          rawSession: null,
          detectedAt: fallbackDetectedAt,
          isInputInjectionSupported: false
        },
        lastBlockedAt: null
      })
    }
  },
  refreshSessionInfo: async () => {
    set({ isChecking: true })

    try {
      const result = await window.api.system.refreshSessionInfo()

      set((state) => {
        const wasBlocked =
          (state.sessionInfo?.sessionType ?? result.previousSessionType) === 'WAYLAND'
        const movedToX11 = result.sessionInfo.sessionType === 'X11'

        return {
          sessionInfo: result.sessionInfo,
          isChecking: false,
          lastBlockedAt:
            result.sessionInfo.sessionType === 'WAYLAND'
              ? (state.lastBlockedAt ?? result.sessionInfo.detectedAt)
              : null,
          showSuccessUntil: wasBlocked && movedToX11 ? Date.now() + SUCCESS_BANNER_TTL_MS : null
        }
      })
    } catch (error) {
      console.error('[session.store] refreshSessionInfo failed:', error)
      set({ isChecking: false })
    }
  },
  openWaylandGuide: () => {
    const current = useAppStore.getState().activeScreen

    set({
      guideReturnScreen: current === 'wayland-guide' ? 'dashboard' : current
    })

    useAppStore.getState().setActiveScreen('wayland-guide')
  },
  closeWaylandGuide: () => {
    const fallback = get().guideReturnScreen ?? 'dashboard'
    useAppStore.getState().setActiveScreen(fallback)
  },
  consumeSuccessAutohide: () => {
    const showSuccessUntil = get().showSuccessUntil
    if (!showSuccessUntil) return

    if (Date.now() >= showSuccessUntil) {
      set({ showSuccessUntil: null })
    }
  }
}))
