import { app, nativeTheme } from 'electron'
import ElectronStore from 'electron-store'
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type ThemeMode,
  type AppSettings,
  UpdateAppSettingsInputSchema,
  type UpdateAppSettingsInput
} from '../../shared/api'

const Store = ((ElectronStore as unknown as { default?: typeof ElectronStore }).default ??
  ElectronStore) as typeof ElectronStore

class SettingsService {
  private readonly store = new Store<{ settings: AppSettings }>({
    name: 'settings',
    defaults: {
      settings: DEFAULT_APP_SETTINGS
    }
  })

  get(): AppSettings {
    const current = this.store.get('settings')
    const merged = {
      ...DEFAULT_APP_SETTINGS,
      ...current
    }

    const parsed = AppSettingsSchema.parse(merged)
    this.store.set('settings', parsed)
    return parsed
  }

  update(input: UpdateAppSettingsInput): AppSettings {
    const parsed = UpdateAppSettingsInputSchema.parse(input)
    const next = AppSettingsSchema.parse({
      ...this.get(),
      ...parsed
    })

    this.store.set('settings', next)

    // Changing other settings should never fail because of OS-specific startup APIs.
    if (parsed.launchAtStartup !== undefined) {
      this.applyLaunchAtStartup(next.launchAtStartup)
    }

    if (parsed.themeMode !== undefined) {
      this.applyThemeMode(next.themeMode)
    }

    return next
  }

  applyThemeMode(mode: ThemeMode): void {
    try {
      nativeTheme.themeSource = mode === 'DARK' ? 'dark' : 'light'
    } catch (error) {
      console.warn('[settings] Failed to apply theme mode:', error)
    }
  }

  applyLaunchAtStartup(enabled: boolean): void {
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
      return
    }

    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: enabled
      })
    } catch (error) {
      console.warn('[settings] Failed to apply launch-at-startup:', error)
    }
  }
}

export const settingsService = new SettingsService()
