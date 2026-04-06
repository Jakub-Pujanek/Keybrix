import { create } from 'zustand'
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type UpdateAppSettingsInput
} from '../../../shared/api'
import type { Language } from '../../../shared/i18n'

type SettingsState = {
  appSettings: AppSettings | null
  isLoading: boolean
  loadAppSettings: () => Promise<void>
  updateAppSettings: (patch: UpdateAppSettingsInput) => Promise<void>
  language: Language
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appSettings: DEFAULT_APP_SETTINGS,
  isLoading: false,
  language: DEFAULT_APP_SETTINGS.language,
  loadAppSettings: async () => {
    set({ isLoading: true })

    try {
      const appSettings = await window.api.settings.get()
      set({ appSettings, language: appSettings.language })
    } catch (error) {
      console.error('[settings] initial load failed, using defaults:', error)
      set({ appSettings: DEFAULT_APP_SETTINGS, language: DEFAULT_APP_SETTINGS.language })
    } finally {
      set({ isLoading: false })
    }
  },
  updateAppSettings: async (patch) => {
    const previous = get().appSettings ?? DEFAULT_APP_SETTINGS
    const optimistic = AppSettingsSchema.safeParse({
      ...previous,
      ...patch
    })

    if (optimistic.success) {
      set({ appSettings: optimistic.data, language: optimistic.data.language })
    }

    try {
      const next = await window.api.settings.update(patch)
      set({ appSettings: next, language: next.language })
    } catch (error) {
      console.error('[settings] update failed:', error)

      const fallback = await window.api.settings.get().catch(() => null)
      if (!fallback) {
        // Keep optimistic state if backend is temporarily unavailable.
        return
      }

      set({ appSettings: fallback, language: fallback.language })
    }
  }
}))
