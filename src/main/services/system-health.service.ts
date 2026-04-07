import { SystemStatusSchema, type SystemStatus } from '../../shared/api'

type SystemStatusListener = (status: SystemStatus) => void

const HEALTH_CHECK_INTERVAL_MS = 5000
const REQUIRED_CONSECUTIVE_SAMPLES = 2

const evaluateStatus = (): SystemStatus => {
  const rssMb = process.memoryUsage().rss / (1024 * 1024)
  const status: SystemStatus = rssMb > 1200 ? 'DEGRADED' : 'OPTIMAL'
  return SystemStatusSchema.parse(status)
}

export class SystemHealthService {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly listeners = new Set<SystemStatusListener>()
  private currentStatus: SystemStatus = 'OPTIMAL'
  private candidateStatus: SystemStatus | null = null
  private candidateCount = 0

  start(): void {
    if (this.timer) return

    this.timer = setInterval(() => {
      this.tick()
    }, HEALTH_CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  onStatusChange(listener: SystemStatusListener): () => void {
    this.listeners.add(listener)
    listener(this.currentStatus)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private tick(): void {
    const sampled = evaluateStatus()

    if (sampled === this.currentStatus) {
      this.candidateStatus = null
      this.candidateCount = 0
      return
    }

    if (this.candidateStatus !== sampled) {
      this.candidateStatus = sampled
      this.candidateCount = 1
      return
    }

    this.candidateCount += 1
    if (this.candidateCount < REQUIRED_CONSECUTIVE_SAMPLES) {
      return
    }

    this.currentStatus = sampled
    this.candidateStatus = null
    this.candidateCount = 0

    for (const listener of this.listeners) {
      listener(this.currentStatus)
    }
  }
}

export const systemHealthService = new SystemHealthService()
