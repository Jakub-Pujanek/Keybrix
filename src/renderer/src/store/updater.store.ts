import { create } from 'zustand'
import type { UpdaterState } from '../../../shared/api'

type UpdaterStoreState = {
  updaterState: UpdaterState
  isToastVisible: boolean
  isInstalling: boolean
  subscribeUpdater: () => () => void
  dismissToast: () => void
  installNow: () => Promise<boolean>
}

const INITIAL_UPDATER_STATE: UpdaterState = {
  status: 'IDLE'
}

let updaterUnsubscribe: (() => void) | null = null

export const useUpdaterStore = create<UpdaterStoreState>((set, get) => ({
  updaterState: INITIAL_UPDATER_STATE,
  isToastVisible: false,
  isInstalling: false,
  subscribeUpdater: () => {
    if (updaterUnsubscribe) {
      return updaterUnsubscribe
    }

    const off = window.api.updater.onStateChange((nextState) => {
      set({
        updaterState: nextState,
        isToastVisible: nextState.status === 'DOWNLOADED'
      })
    })

    updaterUnsubscribe = () => {
      off()
      updaterUnsubscribe = null
    }

    return updaterUnsubscribe
  },
  dismissToast: () => {
    set({ isToastVisible: false })
  },
  installNow: async () => {
    if (get().updaterState.status !== 'DOWNLOADED') {
      return false
    }

    set({ isInstalling: true })

    try {
      const installed = await window.api.updater.installNow()
      if (installed) {
        set({ isToastVisible: false })
      }
      return installed
    } catch (error) {
      console.error('[updater.store] installNow failed:', error)
      return false
    } finally {
      set({ isInstalling: false })
    }
  }
}))
