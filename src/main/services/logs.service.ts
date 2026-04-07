import { ActivityLogSchema, type ActivityLog } from '../../shared/api'
import { createActivityLog, mainStore } from '../store'

const LOG_RETENTION_LIMIT = 200

export class LogsService {
  append(input: Pick<ActivityLog, 'level' | 'message'>): ActivityLog {
    const nextLog = createActivityLog(input)

    mainStore.updateState((prev) => ({
      ...prev,
      logs: {
        buffer: [nextLog, ...prev.logs.buffer].slice(0, LOG_RETENTION_LIMIT)
      }
    }))

    return nextLog
  }

  getRecent(limit: number = LOG_RETENTION_LIMIT): ActivityLog[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : LOG_RETENTION_LIMIT
    const logs = mainStore.getState().logs.buffer.slice(0, safeLimit)
    return logs.map((log) => ActivityLogSchema.parse(log))
  }
}

export const logsService = new LogsService()
