import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  ActivityLogSchema,
  IPC_CHANNELS,
  MacroSchema,
  MacroStatusChangeEventSchema,
  SaveMacroInputSchema,
  SystemStatusSchema,
  ToggleMacroInputSchema,
  DashboardStatsSchema
} from '../shared/api'
import { ShortcutManager } from './keyboard'
import { MacroRunner } from './macro-runner'
import { MacroStore } from './store'

let macroStore: MacroStore
let shortcutManager: ShortcutManager
let macroRunner: MacroRunner
let statusInterval: NodeJS.Timeout | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const broadcast = <T>(channel: string, payload: T): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}

const detectSystemStatus = (): 'OPTIMAL' | 'DEGRADED' => {
  const { heapUsed, heapTotal } = process.memoryUsage()
  return heapUsed / heapTotal > 0.85 ? 'DEGRADED' : 'OPTIMAL'
}

const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.macros.getAll, () => {
    return macroStore.getAllMacros().map((macro) => MacroSchema.parse(macro))
  })

  ipcMain.handle(IPC_CHANNELS.macros.getById, (_event, id: unknown) => {
    const macroId = SaveMacroInputSchema.shape.id.unwrap().parse(id)
    const macro = macroStore.getMacroById(macroId)
    return macro ? MacroSchema.parse(macro) : null
  })

  ipcMain.handle(IPC_CHANNELS.macros.save, (_event, payload: unknown) => {
    const input = SaveMacroInputSchema.parse(payload)
    const saved = macroStore.saveMacro(input)

    shortcutManager.registerAllActive(macroStore.getAllMacros())
    return MacroSchema.parse(saved)
  })

  ipcMain.handle(IPC_CHANNELS.macros.delete, (_event, id: unknown) => {
    const macroId = SaveMacroInputSchema.shape.id.unwrap().parse(id)
    shortcutManager.unregisterMacro(macroId)
    return macroStore.deleteMacro(macroId)
  })

  ipcMain.handle(IPC_CHANNELS.macros.toggle, (_event, payload: unknown) => {
    const { id, isActive } = ToggleMacroInputSchema.parse(payload)
    const ok = macroStore.toggleMacro(id, isActive)
    if (!ok) return false

    if (isActive) {
      const macro = macroStore.getMacroById(id)
      if (macro) shortcutManager.registerMacro(macro)
    } else {
      shortcutManager.unregisterMacro(id)
    }

    return true
  })

  ipcMain.handle(IPC_CHANNELS.macros.run, async (_event, id: unknown) => {
    const macroId = SaveMacroInputSchema.shape.id.unwrap().parse(id)
    await macroRunner.runMacroById(macroId)
  })

  ipcMain.handle(IPC_CHANNELS.stats.get, () => {
    return DashboardStatsSchema.parse(macroStore.getDashboardStats())
  })

  ipcMain.handle(IPC_CHANNELS.logs.getRecent, () => {
    return macroStore.getRecentLogs().map((log) => ActivityLogSchema.parse(log))
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  macroStore = new MacroStore()
  macroRunner = new MacroRunner(macroStore)
  shortcutManager = new ShortcutManager((macroId) => {
    void macroRunner.runMacroById(macroId)
  })

  shortcutManager.registerAllActive(macroStore.getAllMacros())
  registerIpcHandlers()

  macroStore.on('log', (payload: unknown) => {
    const parsed = ActivityLogSchema.safeParse(payload)
    if (!parsed.success) return
    broadcast(IPC_CHANNELS.logs.newLog, parsed.data)
  })

  macroStore.on('macro-status-changed', (payload: unknown) => {
    const parsed = MacroStatusChangeEventSchema.safeParse(payload)
    if (!parsed.success) return
    broadcast(IPC_CHANNELS.system.macroStatusChanged, parsed.data)
  })

  statusInterval = setInterval(() => {
    const status = SystemStatusSchema.parse(detectSystemStatus())
    broadcast(IPC_CHANNELS.system.statusUpdate, status)
  }, 5000)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  if (statusInterval) {
    clearInterval(statusInterval)
    statusInterval = null
  }
  if (shortcutManager) {
    shortcutManager.dispose()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
