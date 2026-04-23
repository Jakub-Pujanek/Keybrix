import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { type UpdaterState } from '../../shared/api'
import { logsService } from './logs.service'
import { structuredLogger } from './structured-logger.service'

const STARTUP_CHECK_DELAY_MS = 15_000
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export class AutoUpdateService {
  private initialized = false
  private periodicCheckTimer: ReturnType<typeof setInterval> | null = null
  private hasDownloadedUpdate = false
  private readonly listeners = new Set<(state: UpdaterState) => void>()

  onStateChange(listener: (state: UpdaterState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  installNow(): boolean {
    if (!this.hasDownloadedUpdate) {
      return false
    }

    try {
      autoUpdater.quitAndInstall()
      return true
    } catch (error) {
      structuredLogger.warn('Auto updater install action failed.', {
        scope: 'auto-updater.install',
        reason: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  start(): void {
    if (this.initialized) return
    this.initialized = true

    if (!app.isPackaged) {
      structuredLogger.info('Auto updater skipped in development mode.', {
        scope: 'auto-updater.start'
      })
      return
    }

    if (process.env['KEYBRIX_DISABLE_AUTO_UPDATER'] === '1') {
      structuredLogger.warn('Auto updater disabled by environment variable.', {
        scope: 'auto-updater.start'
      })
      return
    }

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.disableWebInstaller = false

    autoUpdater.on('checking-for-update', () => {
      this.emit({ status: 'CHECKING' })
      logsService.append({
        level: 'INFO',
        message: '[updater] checking for update'
      })
    })

    autoUpdater.on('update-available', (updateInfo) => {
      this.emit({ status: 'AVAILABLE', version: updateInfo.version })
      logsService.append({
        level: 'INFO',
        message: `[updater] update available: version=${updateInfo.version}`
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.emit({ status: 'IDLE' })
      logsService.append({
        level: 'INFO',
        message: '[updater] no update available'
      })
    })

    autoUpdater.on('error', (error) => {
      const reason = error instanceof Error ? error.message : String(error)
      structuredLogger.warn('Auto updater error.', {
        scope: 'auto-updater.error',
        reason
      })
      this.emit({ status: 'ERROR', message: reason })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.emit({
        status: 'DOWNLOADING',
        progressPercent: Number(progress.percent.toFixed(1))
      })
      logsService.append({
        level: 'INFO',
        message: `[updater] download progress: ${progress.percent.toFixed(1)}%`
      })
    })

    autoUpdater.on('update-downloaded', (updateInfo) => {
      this.hasDownloadedUpdate = true
      this.emit({ status: 'DOWNLOADED', version: updateInfo.version })
      logsService.append({
        level: 'INFO',
        message: `[updater] update downloaded: version=${updateInfo.version}`
      })
    })

    setTimeout(() => {
      this.checkForUpdates('startup')
    }, STARTUP_CHECK_DELAY_MS)

    this.periodicCheckTimer = setInterval(() => {
      this.checkForUpdates('interval')
    }, PERIODIC_CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.periodicCheckTimer) {
      clearInterval(this.periodicCheckTimer)
      this.periodicCheckTimer = null
    }
  }

  private checkForUpdates(trigger: 'startup' | 'interval'): void {
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      structuredLogger.warn('Auto updater check failed.', {
        scope: 'auto-updater.check',
        reason: error instanceof Error ? error.message : String(error),
        details: {
          trigger
        }
      })
    })
  }

  private emit(state: UpdaterState): void {
    for (const listener of this.listeners) {
      listener(state)
    }
  }
}

export const autoUpdateService = new AutoUpdateService()
