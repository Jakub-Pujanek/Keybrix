import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityLog } from '../../../shared/api'
import { useActivityStore } from './activity.store'

let onNewLogListener: ((log: ActivityLog) => void) | null = null

const getRecentMock = vi.fn<() => Promise<ActivityLog[]>>()
const onNewLogMock = vi.fn<(callback: (log: ActivityLog) => void) => () => void>((callback) => {
  onNewLogListener = callback
  return vi.fn()
})

const setupApiMock = (): void => {
  ;(window as { api: unknown }).api = {
    logs: {
      getRecent: getRecentMock,
      onNewLog: onNewLogMock
    }
  } as unknown
}

describe('activity.store', () => {
  beforeEach(() => {
    getRecentMock.mockReset()
    onNewLogMock.mockClear()
    onNewLogListener = null

    setupApiMock()

    useActivityStore.setState({
      logs: [],
      isLoading: false
    })
  })

  it('deduplicates duplicate ids returned by getRecent', async () => {
    getRecentMock.mockResolvedValueOnce([
      { id: 'log-1', timestamp: '[10:00:00]', level: 'INFO', message: 'alpha' },
      { id: 'log-1', timestamp: '[10:00:00]', level: 'INFO', message: 'alpha duplicate' },
      { id: 'log-2', timestamp: '[10:00:01]', level: 'WARN', message: 'beta' }
    ])

    await useActivityStore.getState().loadRecentLogs()

    expect(useActivityStore.getState().logs.map((log) => log.id)).toEqual(['log-1', 'log-2'])
  })

  it('keeps unique order when realtime log repeats existing id', () => {
    useActivityStore.setState({
      logs: [
        { id: 'log-1', timestamp: '[10:00:00]', level: 'INFO', message: 'existing' },
        { id: 'log-2', timestamp: '[10:00:01]', level: 'WARN', message: 'existing' }
      ],
      isLoading: false
    })

    useActivityStore.getState().subscribeRealtimeLogs()

    onNewLogListener?.({
      id: 'log-1',
      timestamp: '[10:00:02]',
      level: 'INFO',
      message: 'duplicate from realtime'
    })

    expect(useActivityStore.getState().logs.map((log) => log.id)).toEqual(['log-1', 'log-2'])
    expect(useActivityStore.getState().logs).toHaveLength(2)
  })

  it('merges getRecent with existing realtime entries without duplicates', async () => {
    useActivityStore.setState({
      logs: [{ id: 'log-3', timestamp: '[10:00:02]', level: 'ERR', message: 'realtime latest' }],
      isLoading: false
    })

    getRecentMock.mockResolvedValueOnce([
      { id: 'log-2', timestamp: '[10:00:01]', level: 'WARN', message: 'older' },
      { id: 'log-3', timestamp: '[10:00:02]', level: 'ERR', message: 'duplicate latest' },
      { id: 'log-1', timestamp: '[10:00:00]', level: 'INFO', message: 'oldest' }
    ])

    await useActivityStore.getState().loadRecentLogs()

    expect(useActivityStore.getState().logs.map((log) => log.id)).toEqual([
      'log-2',
      'log-3',
      'log-1'
    ])
  })
})
