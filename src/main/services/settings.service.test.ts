import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeThemeMock = { themeSource: 'dark' as 'dark' | 'light' }
const appMock = {
  setLoginItemSettings: vi.fn()
}

class MockStore<T extends Record<string, unknown>> {
  private data: Partial<T>

  constructor(options: { defaults?: Partial<T> } = {}) {
    this.data = (options.defaults ?? {}) as Partial<T>
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key] as T[K]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
  }
}

vi.mock('electron', () => ({
  app: appMock,
  nativeTheme: nativeThemeMock
}))

vi.mock('electron-store', () => ({
  default: MockStore
}))

describe('settingsService theme integration', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    nativeThemeMock.themeSource = 'dark'
    appMock.setLoginItemSettings.mockReset()
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    })
  })

  it('applyThemeMode sets nativeTheme source for LIGHT', async () => {
    vi.resetModules()
    const { settingsService } = await import('./settings.service')

    settingsService.applyThemeMode('LIGHT')

    expect(nativeThemeMock.themeSource).toBe('light')
  })

  it('update applies theme mode when patch includes themeMode', async () => {
    vi.resetModules()
    const { settingsService } = await import('./settings.service')

    settingsService.update({ themeMode: 'LIGHT' })

    expect(nativeThemeMock.themeSource).toBe('light')
  })

  it('update applies launch-at-startup side effect on supported platform', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    })

    vi.resetModules()
    const { settingsService } = await import('./settings.service')

    settingsService.update({ launchAtStartup: false })

    expect(appMock.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      openAsHidden: false
    })
  })
})
