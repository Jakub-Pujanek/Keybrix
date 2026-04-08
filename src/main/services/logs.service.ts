import { ActivityLogSchema, type ActivityLog } from '../../shared/api'
import { createActivityLog, mainStore } from '../store'

const LOG_RETENTION_LIMIT = 200

type LogListener = (log: ActivityLog) => void

export class LogsService {
  private readonly listeners = new Set<LogListener>()

  append(input: Pick<ActivityLog, 'level' | 'message'> & { runId?: string }): ActivityLog {
    const nextLog = createActivityLog(input)

    mainStore.updateState((prev) => ({
      ...prev,
      logs: {
        buffer: [nextLog, ...prev.logs.buffer].slice(0, LOG_RETENTION_LIMIT)
      }
    }))

    for (const listener of this.listeners) {
      listener(nextLog)
    }

    return nextLog
  }

  getRecent(limit: number = LOG_RETENTION_LIMIT): ActivityLog[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : LOG_RETENTION_LIMIT
    const logs = mainStore.getState().logs.buffer.slice(0, safeLimit)
    return logs.map((log) => ActivityLogSchema.parse(log))
  }

  onNewLog(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const logsService = new LogsService()
