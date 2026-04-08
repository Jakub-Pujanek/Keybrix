import { type ActivityLog, type AuditAction, type LogLevel } from '../../shared/api'
import { createAuditEvent, mainStore } from '../store'
import { logsService } from './logs.service'

const AUDIT_RETENTION_LIMIT = 100

type LogContext = {
  scope: string
  correlationId?: string
  macroId?: string
  reason?: string
  details?: Record<string, unknown>
}

const formatContext = (context?: LogContext): string => {
  if (!context) return ''

  const payload: Record<string, unknown> = {
    scope: context.scope
  }

  if (context.correlationId) payload.correlationId = context.correlationId
  if (context.macroId) payload.macroId = context.macroId
  if (context.reason) payload.reason = context.reason
  if (context.details) payload.details = context.details

  return ` | context=${JSON.stringify(payload)}`
}

export class StructuredLoggerService {
  log(input: { level: LogLevel; message: string; context?: LogContext }): ActivityLog {
    return logsService.append({
      level: input.level,
      message: `${input.message}${formatContext(input.context)}`
    })
  }

  info(message: string, context?: LogContext): ActivityLog {
    return this.log({ level: 'INFO', message, context })
  }

  warn(message: string, context?: LogContext): ActivityLog {
    return this.log({ level: 'WARN', message, context })
  }

  error(message: string, context?: LogContext): ActivityLog {
    return this.log({ level: 'ERR', message, context })
  }

  run(message: string, context?: LogContext): ActivityLog {
    return this.log({ level: 'RUN', message, context })
  }

  audit(input: {
    action: AuditAction
    targetId?: string
    correlationId?: string
    reason?: string
    meta?: Record<string, unknown>
  }): void {
    const event = createAuditEvent(input)

    mainStore.updateState((prev) => ({
      ...prev,
      audit: {
        buffer: [event, ...prev.audit.buffer].slice(0, AUDIT_RETENTION_LIMIT)
      }
    }))
  }
}

export const structuredLogger = new StructuredLoggerService()
