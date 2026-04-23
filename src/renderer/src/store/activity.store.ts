import { create } from 'zustand'
import type { ActivityLog } from '../../../shared/api'

const ACTIVITY_LOG_LIMIT = 40

const mergeUniqueLogs = (
  preferred: ActivityLog[],
  fallback: ActivityLog[],
  limit: number
): ActivityLog[] => {
  const merged: ActivityLog[] = []
  const seen = new Set<string>()

  for (const source of [preferred, fallback]) {
    for (const log of source) {
      if (seen.has(log.id)) {
        continue
      }

      seen.add(log.id)
      merged.push(log)

      if (merged.length >= limit) {
        return merged
      }
    }
  }

  return merged
}

type ActivityState = {
  logs: ActivityLog[]
  isLoading: boolean
  loadRecentLogs: () => Promise<ActivityLog[]>
  subscribeRealtimeLogs: () => () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  logs: [],
  isLoading: false,
  loadRecentLogs: async () => {
    set({ isLoading: true })
    const logs = await window.api.logs.getRecent()
    set((state) => ({
      logs: mergeUniqueLogs(logs, state.logs, ACTIVITY_LOG_LIMIT),
      isLoading: false
    }))
    return logs
  },
  subscribeRealtimeLogs: () => {
    const off = window.api.logs.onNewLog((nextLog) => {
      set((state) => ({
        logs: mergeUniqueLogs([nextLog], state.logs, ACTIVITY_LOG_LIMIT)
      }))
    })

    return () => off()
  }
}))
