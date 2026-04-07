import { DashboardStatsSchema, type DashboardStats } from '../../shared/api'
import { mainStore, type MainStatsCounters } from '../store'
import { macroRepository } from './macro.repository'

const toRoundedPercentage = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))))
}

export class StatsService {
  getDashboardStats(): DashboardStats {
    const counters = this.getCounters()
    const macros = macroRepository.getAll()
    const successRate =
      counters.totalRuns > 0 ? (counters.successfulRuns / counters.totalRuns) * 100 : 0

    return DashboardStatsSchema.parse({
      totalAutomations: macros.length,
      activeNow: macros.filter((macro) => macro.isActive).length,
      successRate: toRoundedPercentage(successRate),
      timeSavedMinutes: counters.timeSavedMinutes
    })
  }

  recordRun(result: { success: boolean; timeSavedMinutes?: number }): MainStatsCounters {
    let nextCounters: MainStatsCounters | null = null

    mainStore.updateState((prev) => {
      const prevCounters = prev.stats.counters
      const increment = result.timeSavedMinutes ? Math.max(0, result.timeSavedMinutes) : 0

      nextCounters = {
        totalRuns: prevCounters.totalRuns + 1,
        successfulRuns: prevCounters.successfulRuns + (result.success ? 1 : 0),
        failedRuns: prevCounters.failedRuns + (result.success ? 0 : 1),
        timeSavedMinutes: prevCounters.timeSavedMinutes + increment
      }

      return {
        ...prev,
        stats: {
          counters: nextCounters
        }
      }
    })

    if (!nextCounters) {
      throw new Error('Failed to update run statistics.')
    }

    return nextCounters
  }

  getCounters(): MainStatsCounters {
    return mainStore.getState().stats.counters
  }
}

export const statsService = new StatsService()
