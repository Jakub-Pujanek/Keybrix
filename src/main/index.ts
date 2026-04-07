import { app, shell, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  ActivityLogSchema,
  DashboardStatsSchema,
  MacroStatusChangeEventSchema,
  SystemStatusSchema,
  type AppSettings,
  IPC_CHANNELS,
  MacroRunNotificationInputSchema,
  MacroSchema,
  RecordShortcutInputSchema,
  SaveMacroInputSchema,
  ToggleMacroInputSchema,
  UpdateAppSettingsInputSchema
} from '../shared/api'
import { settingsService } from './services/settings.service'
import { logsService } from './services/logs.service'
import { macroService } from './services/macro.service'
import { statsService } from './services/stats.service'
import { systemHealthService } from './services/system-health.service'
import { shortcutManager } from './keyboard'
import { t } from '../shared/i18n'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
const runtimeDisposers: Array<() => void> = []

// Phase 0 backend guardrails:
// - Main is the source of truth for runtime and domain data.
// - Preload must become a thin IPC bridge (no domain timers/state).
// - Next IPC scope for Phase B: macros.*, stats.get, logs.getRecent,
//   system push channels, keyboard.recordShortcut.

const getSettings = (): AppSettings => settingsService.get()

const broadcastToRenderers = (channel: string, payload: unknown): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(channel, payload)
  }
}

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
  // Main handlers keep renderer side-effect free:
  // validation -> domain service -> typed payload back to preload.

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

      if (parsed.globalMaster === false) {
        macroService.deactivateAll()
        shortcutManager.unregisterAll()
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

  ipcMain.handle(IPC_CHANNELS.macros.getAll, () => {
    try {
      const macros = macroService.getAll()
      return macros.map((macro) => MacroSchema.parse(macro))
    } catch (error) {
      console.error('[macros][main] getAll failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.getById, (_, id) => {
    try {
      if (typeof id !== 'string' || id.length === 0) return null
      const macro = macroService.getById(id)
      return macro ? MacroSchema.parse(macro) : null
    } catch (error) {
      console.error('[macros][main] getById failed:', error, id)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.save, (_, input) => {
    try {
      const parsed = SaveMacroInputSchema.parse(input)
      const macro = macroService.save(parsed)
      return MacroSchema.parse(macro)
    } catch (error) {
      console.error('[macros][main] save failed:', error, input)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.delete, (_, id) => {
    try {
      if (typeof id !== 'string' || id.length === 0) return false
      return macroService.delete(id)
    } catch (error) {
      console.error('[macros][main] delete failed:', error, id)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.toggle, (_, id, isActive) => {
    try {
      const parsed = ToggleMacroInputSchema.parse({ id, isActive })
      return macroService.toggle(parsed.id, parsed.isActive)
    } catch (error) {
      console.error('[macros][main] toggle failed:', error, { id, isActive })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.stats.get, () => {
    try {
      const stats = statsService.getDashboardStats()
      return DashboardStatsSchema.parse(stats)
    } catch (error) {
      console.error('[stats][main] get failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.logs.getRecent, () => {
    try {
      const logs = logsService.getRecent()
      return logs.map((log) => ActivityLogSchema.parse(log))
    } catch (error) {
      console.error('[logs][main] getRecent failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.keyboard.recordShortcut, (_, input) => {
    try {
      const parsed = RecordShortcutInputSchema.parse(input)
      return macroService.reserveShortcut(parsed)
    } catch (error) {
      console.error('[keyboard][main] recordShortcut failed:', error, input)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.run, async (_, id) => {
    try {
      if (typeof id !== 'string' || id.length === 0) return false

      const success = await macroService.run(id)
      if (!success) return false

      const macro = macroService.getById(id)
      if (!macro) return false

      const settings = getSettings()
      if (settings.notifyOnMacroRun && Notification.isSupported()) {
        const notification = new Notification({
          title: 'KeyBrix',
          body: t(settings.language, 'notifications.macroStarted', {
            macroName: macro.name
          })
        })

        notification.show()
      }

      return true
    } catch (error) {
      console.error('[macros][main] run failed:', error, id)
      throw error
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  settingsService.applyLaunchAtStartup(getSettings().launchAtStartup)
  settingsService.applyThemeMode(getSettings().themeMode)
  macroService.bootstrapShortcuts()

  runtimeDisposers.push(
    logsService.onNewLog((log) => {
      const parsed = ActivityLogSchema.parse(log)
      broadcastToRenderers(IPC_CHANNELS.logs.newLog, parsed)
    })
  )

  runtimeDisposers.push(
    macroService.onStatusChange((event) => {
      const parsed = MacroStatusChangeEventSchema.parse(event)
      broadcastToRenderers(IPC_CHANNELS.system.macroStatusChanged, parsed)
    })
  )

  runtimeDisposers.push(
    systemHealthService.onStatusChange((status) => {
      const parsed = SystemStatusSchema.parse(status)
      broadcastToRenderers(IPC_CHANNELS.system.statusUpdate, parsed)
    })
  )

  systemHealthService.start()
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
  systemHealthService.stop()
  shortcutManager.dispose()
  for (const dispose of runtimeDisposers.splice(0)) {
    dispose()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
