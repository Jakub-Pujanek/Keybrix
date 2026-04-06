import { app, shell, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  type AppSettings,
  IPC_CHANNELS,
  MacroRunNotificationInputSchema,
  UpdateAppSettingsInputSchema
} from '../shared/api'
import { settingsService } from './services/settings.service'
import { t } from '../shared/i18n'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false

const getSettings = (): AppSettings => settingsService.get()

const resolveTrayIconPath = (): string | null => {
  const iconPathCandidates = [
    is.dev ? join(process.cwd(), 'resources/icon.png') : join(process.resourcesPath, 'icon.png'),
    is.dev ? join(process.cwd(), 'public/keybrix.png') : join(process.resourcesPath, 'keybrix.png')
  ]

  return iconPathCandidates.find((iconPath) => existsSync(iconPath)) ?? null
}

const ensureTray = (window: BrowserWindow): void => {
  const settings = getSettings()
  const translate = (key: 'tray.open' | 'tray.quit'): string => t(settings.language, key)

  const iconPath = resolveTrayIconPath()
  if (!iconPath) return

  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) return

  if (!appTray) {
    appTray = new Tray(icon)
    appTray.setToolTip('KeyBrix')
    appTray.on('click', () => {
      window.show()
      window.focus()
    })
  }

  appTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: translate('tray.open'),
        click: () => {
          window.show()
          window.focus()
        }
      },
      {
        type: 'separator'
      },
      {
        label: translate('tray.quit'),
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
}

const syncTrayForSettings = (window: BrowserWindow): void => {
  const settings = getSettings()
  if (settings.minimizeToTrayOnClose) {
    try {
      ensureTray(window)
    } catch (error) {
      console.warn('[settings] Failed to synchronize tray:', error)
    }
    return
  }

  if (appTray) {
    appTray.destroy()
    appTray = null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const window = mainWindow

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.on('close', (event) => {
    const settings = getSettings()
    if (!settings.minimizeToTrayOnClose || isQuitting) return

    event.preventDefault()
    window.hide()
    ensureTray(window)
  })

  window.on('closed', () => {
    mainWindow = null
  })

  syncTrayForSettings(window)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.settings.get, () => {
    try {
      return getSettings()
    } catch (error) {
      console.error('[settings][main] get failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.settings.update, (_, input) => {
    try {
      const parsed = UpdateAppSettingsInputSchema.parse(input)
      const next = settingsService.update(parsed)

      // Only settings affecting tray behavior should trigger tray synchronization.
      const shouldSyncTray =
        parsed.minimizeToTrayOnClose !== undefined || parsed.language !== undefined

      if (mainWindow && shouldSyncTray) {
        syncTrayForSettings(mainWindow)
      }

      return next
    } catch (error) {
      console.error('[settings][main] update failed:', error, input)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.notifications.macroRun, (_, input) => {
    const parsed = MacroRunNotificationInputSchema.safeParse(input)
    if (!parsed.success) return false

    const settings = getSettings()
    if (!settings.notifyOnMacroRun || !Notification.isSupported()) {
      return false
    }

    const notification = new Notification({
      title: 'KeyBrix',
      body: t(settings.language, 'notifications.macroStarted', {
        macroName: parsed.data.macroName
      })
    })

    notification.show()
    return true
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  settingsService.applyLaunchAtStartup(getSettings().launchAtStartup)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      return
    }

    mainWindow?.show()
    mainWindow?.focus()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
