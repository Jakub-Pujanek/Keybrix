import { act, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import type { KeybrixApi } from '../../shared/api'

let emitRealtimeLog: ((message: string) => void) | null = null

const mockApi: KeybrixApi = {
  macros: {
    getAll: async () => [
      {
        id: 'macro-1',
        name: 'Copy & Paste Pro',
        description: 'mock',
        shortcut: 'CTRL+SHIFT+C',
        isActive: true,
        status: 'RUNNING',
        blocksJson: {}
      }
    ],
    getById: async () => null,
    save: async () => {
      throw new Error('not used')
    },
    delete: async () => true,
    toggle: async () => true,
    runManually: async () => {}
  },
  stats: {
    getDashboardStats: async () => ({
      totalAutomations: 42,
      timeSavedMinutes: 720,
      successRate: 99.8,
      activeNow: 4
    })
  },
  logs: {
    getRecent: async () => [
      {
        id: 'log-1',
        timestamp: '[14:02:11]',
        level: 'RUN',
        message: 'macro started'
      }
    ],
    onNewLog: (callback) => {
      emitRealtimeLog = (message: string) => {
        callback({
          id: `log-${Date.now()}`,
          timestamp: '[14:02:12]',
          level: 'INFO',
          message
        })
      }

      return () => {
        emitRealtimeLog = null
      }
    }
  },
  system: {
    onStatusUpdate: (callback) => {
      callback('OPTIMAL')
      return () => {}
    },
    onMacroStatusChange: () => () => {}
  }
}

describe('App dashboard', () => {
  beforeEach(() => {
    window.api = mockApi
    emitRealtimeLog = null
  })

  afterEach(() => {
    emitRealtimeLog = null
  })

  it('should render configurable dashboard card', async () => {
    render(<App />)

    expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('99.8%')).toBeInTheDocument()
      expect(screen.getByText('Copy & Paste Pro')).toBeInTheDocument()
    })
  })

  it('should stream realtime activity logs', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('recent-activity-logs')).toBeInTheDocument()
    })

    act(() => {
      emitRealtimeLog?.('tick')
    })

    await waitFor(() => {
      expect(screen.getByText('tick')).toBeInTheDocument()
    })
  })
})
