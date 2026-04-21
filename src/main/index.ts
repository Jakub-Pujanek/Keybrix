import { app, shell, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  ActivityLogSchema,
  DashboardStatsSchema,
  MacroStatusChangeEventSchema,
  MousePickerPointSchema,
  MousePickerPreviewSchema,
  SystemStatusSchema,
  type AppSettings,
  IPC_CHANNELS,
  MacroRunNotificationInputSchema,
  ManualRunResultSchema,
  MacroSchema,
  RecordShortcutInputSchema,
  RunMacroRequestSchema,
  SaveMacroInputSchema,
  SessionCheckResultSchema,
  SessionDiagnosticsSchema,
  ToggleMacroInputSchema,
  UpdateAppSettingsInputSchema,
  type SessionType
} from '../shared/api'
import { settingsService } from './services/settings.service'
import { logsService } from './services/logs.service'
import { macroService } from './services/macro.service'
import { statsService } from './services/stats.service'
import { systemHealthService } from './services/system-health.service'
import { shortcutManager } from './keyboard'
import { structuredLogger } from './services/structured-logger.service'
import { macroMigrationService } from './services/macro-migration.service'
import { macroSeedService } from './services/macro-seed.service'
import {
  detectRuntimeSessionInfo,
  detectRuntimeSessionDiagnostics,
  readSessionEnvSnapshot
} from './services/session-detection.service'
import { mousePickerService } from './services/mouse-picker.service'
import { t } from '../shared/i18n'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
const runtimeDisposers: Array<() => void> = []
let mousePickerTraceId: string | null = null
let mousePickerPreviewTraceCounter = 0
const TRACE_MOUSE_PICKER = process.env['KEYBRIX_MOUSE_PICKER_TRACE'] === '1'

// Phase 0 backend guardrails:
// - Main is the source of truth for runtime and domain data.
// - Preload must become a thin IPC bridge (no domain timers/state).
// - Next IPC scope for Phase B: macros.*, stats.get, logs.getRecent,
//   system push channels, keyboard.recordShortcut.

const getSettings = (): AppSettings => settingsService.get()
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error'

let lastSessionType: SessionType | null = null

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
      structuredLogger.error('Settings get failed.', {
        scope: 'ipc.settings.get',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.settings.update, (_, input) => {
    const correlationId = globalThis.crypto.randomUUID()

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

      structuredLogger.audit({
        action: 'SETTINGS_UPDATED',
        correlationId,
        meta: {
          keys: Object.keys(parsed)
        }
      })

      return next
    } catch (error) {
      structuredLogger.error('Settings update failed.', {
        scope: 'ipc.settings.update',
        correlationId,
        reason: getErrorMessage(error),
        details: {
          input
        }
      })
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
      structuredLogger.error('Macros getAll failed.', {
        scope: 'ipc.macros.getAll',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.getById, (_, id) => {
    try {
      if (typeof id !== 'string' || id.length === 0) return null
      const macro = macroService.getById(id)
      return macro ? MacroSchema.parse(macro) : null
    } catch (error) {
      structuredLogger.error('Macros getById failed.', {
        scope: 'ipc.macros.getById',
        reason: getErrorMessage(error),
        details: {
          id
        }
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.save, (_, input) => {
    try {
      const parsed = SaveMacroInputSchema.parse(input)
      const macro = macroService.save(parsed)
      return MacroSchema.parse(macro)
    } catch (error) {
      structuredLogger.error('Macros save failed.', {
        scope: 'ipc.macros.save',
        reason: getErrorMessage(error),
        details: {
          input
        }
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.delete, (_, id) => {
    try {
      if (typeof id !== 'string' || id.length === 0) return false
      return macroService.delete(id)
    } catch (error) {
      structuredLogger.error('Macros delete failed.', {
        scope: 'ipc.macros.delete',
        reason: getErrorMessage(error),
        details: {
          id
        }
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.toggle, (_, id, isActive) => {
    try {
      const parsed = ToggleMacroInputSchema.parse({ id, isActive })
      return macroService.toggle(parsed.id, parsed.isActive)
    } catch (error) {
      structuredLogger.error('Macros toggle failed.', {
        scope: 'ipc.macros.toggle',
        reason: getErrorMessage(error),
        details: {
          id,
          isActive
        }
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.stats.get, () => {
    try {
      const stats = statsService.getDashboardStats()
      return DashboardStatsSchema.parse(stats)
    } catch (error) {
      structuredLogger.error('Stats get failed.', {
        scope: 'ipc.stats.get',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.logs.getRecent, () => {
    try {
      const logs = logsService.getRecent()
      return logs.map((log) => ActivityLogSchema.parse(log))
    } catch (error) {
      structuredLogger.error('Logs getRecent failed.', {
        scope: 'ipc.logs.getRecent',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.keyboard.recordShortcut, (_, input) => {
    try {
      const parsed = RecordShortcutInputSchema.parse(input)
      return macroService.reserveShortcut(parsed)
    } catch (error) {
      structuredLogger.error('Keyboard recordShortcut failed.', {
        scope: 'ipc.keyboard.recordShortcut',
        reason: getErrorMessage(error),
        details: {
          input
        }
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.system.getSessionInfo, () => {
    try {
      const sessionInfo = detectRuntimeSessionInfo()
      lastSessionType = sessionInfo.sessionType

      structuredLogger.info('Session probe completed.', {
        scope: 'ipc.system.getSessionInfo',
        details: {
          sessionType: sessionInfo.sessionType,
          rawSession: sessionInfo.rawSession,
          source: sessionInfo.detectionSource,
          confidence: sessionInfo.detectionConfidence,
          env: readSessionEnvSnapshot()
        }
      })

      return sessionInfo
    } catch (error) {
      structuredLogger.error('System getSessionInfo failed.', {
        scope: 'ipc.system.getSessionInfo',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.system.getSessionDiagnostics, () => {
    try {
      const diagnostics = detectRuntimeSessionDiagnostics()

      structuredLogger.info('Session diagnostics requested.', {
        scope: 'ipc.system.getSessionDiagnostics',
        details: {
          sessionType: diagnostics.sessionInfo.sessionType,
          source: diagnostics.sessionInfo.detectionSource,
          confidence: diagnostics.sessionInfo.detectionConfidence,
          probes: diagnostics.probes
        }
      })

      return SessionDiagnosticsSchema.parse(diagnostics)
    } catch (error) {
      structuredLogger.error('System getSessionDiagnostics failed.', {
        scope: 'ipc.system.getSessionDiagnostics',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.system.refreshSessionInfo, () => {
    try {
      const sessionInfo = detectRuntimeSessionInfo()
      const previousSessionType = lastSessionType ?? sessionInfo.sessionType

      const result = SessionCheckResultSchema.parse({
        previousSessionType,
        sessionInfo,
        changed: previousSessionType !== sessionInfo.sessionType
      })

      lastSessionType = sessionInfo.sessionType

      structuredLogger.info('Session refresh completed.', {
        scope: 'ipc.system.refreshSessionInfo',
        details: {
          previousSessionType,
          currentSessionType: sessionInfo.sessionType,
          changed: result.changed,
          rawSession: sessionInfo.rawSession,
          source: sessionInfo.detectionSource,
          confidence: sessionInfo.detectionConfidence,
          env: readSessionEnvSnapshot()
        }
      })

      return result
    } catch (error) {
      structuredLogger.error('System refreshSessionInfo failed.', {
        scope: 'ipc.system.refreshSessionInfo',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.mousePicker.start, () => {
    try {
      const started = mousePickerService.start()
      if (started) {
        mousePickerTraceId = globalThis.crypto.randomUUID()
        mousePickerPreviewTraceCounter = 0
      }

      if (TRACE_MOUSE_PICKER) {
        logsService.append({
          level: 'INFO',
          message: `[mouse-picker-trace] main ipc.start started=${String(started)} traceId=${mousePickerTraceId ?? 'none'} windows=${BrowserWindow.getAllWindows().length}`
        })
      }

      return started
    } catch (error) {
      structuredLogger.error('Mouse picker start failed.', {
        scope: 'ipc.mousePicker.start',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.mousePicker.stop, () => {
    try {
      const stopped = mousePickerService.stop()

      if (TRACE_MOUSE_PICKER) {
        logsService.append({
          level: 'INFO',
          message: `[mouse-picker-trace] main ipc.stop stopped=${String(stopped)} traceId=${mousePickerTraceId ?? 'none'}`
        })
      }

      if (stopped) {
        mousePickerTraceId = null
      }

      return stopped
    } catch (error) {
      structuredLogger.error('Mouse picker stop failed.', {
        scope: 'ipc.mousePicker.stop',
        reason: getErrorMessage(error)
      })
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.run, async (_, input) => {
    const correlationId = globalThis.crypto.randomUUID()
    const fallbackRunId = globalThis.crypto.randomUUID()
    const parsedRequest =
      typeof input === 'string'
        ? RunMacroRequestSchema.safeParse({ id: input })
        : RunMacroRequestSchema.safeParse(input)

    const id = parsedRequest.success ? parsedRequest.data.id : null
    const attemptId = parsedRequest.success ? parsedRequest.data.attemptId : undefined

    try {
      if (!id) {
        return ManualRunResultSchema.parse({
          runId: fallbackRunId,
          success: false,
          reasonCode: 'INVALID_MACRO_ID'
        })
      }

      const result = await macroService.run(id)
      if (!result.success) {
        logsService.append({
          level: 'INFO',
          runId: result.runId,
          message: `IPC run response for '${id}': success=false, reason='${result.reasonCode}'${attemptId ? `, attempt='${attemptId}'` : ''}.`
        })

        structuredLogger.audit({
          action: 'MACRO_RUN_BLOCKED',
          targetId: id,
          correlationId,
          reason: result.reasonCode.toLowerCase()
        })

        return ManualRunResultSchema.parse({
          runId: result.runId,
          success: false,
          reasonCode: result.reasonCode
        })
      }

      const macro = macroService.getById(id)
      if (!macro) {
        return ManualRunResultSchema.parse({
          runId: result.runId,
          success: false,
          reasonCode: 'MACRO_NOT_FOUND'
        })
      }

      structuredLogger.audit({
        action: 'MACRO_RUN',
        targetId: id,
        correlationId
      })

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

      return ManualRunResultSchema.parse({
        runId: result.runId,
        success: true,
        reasonCode: 'SUCCESS'
      })
    } catch (error) {
      logsService.append({
        level: 'ERR',
        runId: fallbackRunId,
        message: `IPC run handler failed for '${String(id)}': ${getErrorMessage(error)}${attemptId ? ` [attempt=${attemptId}]` : ''}.`
      })

      structuredLogger.error('Macros run failed.', {
        scope: 'ipc.macros.run',
        correlationId,
        reason: getErrorMessage(error),
        details: {
          id,
          attemptId
        }
      })
      return ManualRunResultSchema.parse({
        runId: fallbackRunId,
        success: false,
        reasonCode: 'IPC_ERROR'
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.macros.stop, async (_, input) => {
    const correlationId = globalThis.crypto.randomUUID()
    const fallbackRunId = globalThis.crypto.randomUUID()
    const parsedRequest =
      typeof input === 'string'
        ? RunMacroRequestSchema.safeParse({ id: input })
        : RunMacroRequestSchema.safeParse(input)

    const id = parsedRequest.success ? parsedRequest.data.id : null
    const attemptId = parsedRequest.success ? parsedRequest.data.attemptId : undefined

    try {
      if (!id) {
        return ManualRunResultSchema.parse({
          runId: fallbackRunId,
          success: false,
          reasonCode: 'INVALID_MACRO_ID'
        })
      }

      const result = macroService.stop(id)

      if (!result.success) {
        logsService.append({
          level: 'INFO',
          runId: result.runId,
          message: `IPC stop response for '${id}': success=false, reason='${result.reasonCode}'${attemptId ? `, attempt='${attemptId}'` : ''}.`
        })

        structuredLogger.audit({
          action: 'MACRO_RUN_BLOCKED',
          targetId: id,
          correlationId,
          reason: result.reasonCode.toLowerCase()
        })

        return ManualRunResultSchema.parse({
          runId: result.runId,
          success: false,
          reasonCode: result.reasonCode
        })
      }

      logsService.append({
        level: 'INFO',
        runId: result.runId,
        message: `IPC stop accepted for '${id}'${attemptId ? `, attempt='${attemptId}'` : ''}.`
      })

      return ManualRunResultSchema.parse({
        runId: result.runId,
        success: true,
        reasonCode: 'ABORTED'
      })
    } catch (error) {
      logsService.append({
        level: 'ERR',
        runId: fallbackRunId,
        message: `IPC stop handler failed for '${String(id)}': ${getErrorMessage(error)}${attemptId ? ` [attempt=${attemptId}]` : ''}.`
      })

      structuredLogger.error('Macros stop failed.', {
        scope: 'ipc.macros.stop',
        correlationId,
        reason: getErrorMessage(error),
        details: {
          id,
          attemptId
        }
      })

      return ManualRunResultSchema.parse({
        runId: fallbackRunId,
        success: false,
        reasonCode: 'IPC_ERROR'
      })
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  macroMigrationService.migrateLegacyMacrosFromMainStore()
  macroSeedService.ensureMyFirstMacro()
  settingsService.applyLaunchAtStartup(getSettings().launchAtStartup)
  settingsService.applyThemeMode(getSettings().themeMode)
  macroService.bootstrapShortcuts()
  macroService.reconcileRuntimeStatuses()

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

  runtimeDisposers.push(
    mousePickerService.onPreviewUpdate((preview) => {
      const parsed = MousePickerPreviewSchema.parse(preview)
      mousePickerPreviewTraceCounter += 1
      if (
        TRACE_MOUSE_PICKER &&
        (mousePickerPreviewTraceCounter <= 5 || mousePickerPreviewTraceCounter % 10 === 0)
      ) {
        logsService.append({
          level: 'INFO',
          message: `[mouse-picker-trace] main preview#${mousePickerPreviewTraceCounter} traceId=${mousePickerTraceId ?? 'none'} x=${parsed.x} y=${parsed.y} active=${String(parsed.isActive)}`
        })
      }
      broadcastToRenderers(IPC_CHANNELS.mousePicker.previewUpdate, parsed)
    })
  )

  runtimeDisposers.push(
    mousePickerService.onCoordinateSelected((point) => {
      const parsed = MousePickerPointSchema.parse(point)
      if (TRACE_MOUSE_PICKER) {
        logsService.append({
          level: 'INFO',
          message: `[mouse-picker-trace] main coordinate traceId=${mousePickerTraceId ?? 'none'} x=${parsed.x} y=${parsed.y} ts=${parsed.timestamp}`
        })
      }
      broadcastToRenderers(IPC_CHANNELS.mousePicker.coordinateSelected, parsed)
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
  mousePickerService.dispose()
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
