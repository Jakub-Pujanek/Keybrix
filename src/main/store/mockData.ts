import type { ActivityLog, Macro } from '../../shared/api'

const now = new Date()
const hhmmss = (offsetMinutes: number): string => {
  const value = new Date(now.getTime() - offsetMinutes * 60_000)
  const hh = String(value.getHours()).padStart(2, '0')
  const mm = String(value.getMinutes()).padStart(2, '0')
  const ss = String(value.getSeconds()).padStart(2, '0')
  return `[${hh}:${mm}:${ss}]`
}

export const MOCK_MACROS: Macro[] = [
  {
    id: 'macro-copy-paste-pro',
    name: 'Copy & Paste Pro',
    description: 'Multi-format clipboard manager for developer snippets and clean text formatting.',
    shortcut: 'CTRL+SHIFT+C',
    isActive: true,
    status: 'RUNNING',
    blocksJson: {
      commands: [
        { type: 'KEYBOARD_PRESS', key: 'Control' },
        { type: 'KEYBOARD_PRESS', key: 'C' },
        { type: 'DELAY', ms: 120 },
        { type: 'KEYBOARD_PRESS', key: 'Control' },
        { type: 'KEYBOARD_PRESS', key: 'V' }
      ]
    }
  },
  {
    id: 'macro-open-browser',
    name: 'Open Browser',
    description: 'Launches dev environment browsers with pre-authenticated sessions and clear cache.',
    shortcut: 'ALT+B',
    isActive: false,
    status: 'IDLE',
    blocksJson: {
      commands: [{ type: 'DELAY', ms: 200 }]
    }
  },
  {
    id: 'macro-type-signature',
    name: 'Type Signature',
    description: 'Inserts context-aware email signatures based on active application detection.',
    shortcut: 'CMD+SIG',
    isActive: true,
    status: 'ACTIVE',
    blocksJson: {
      commands: [
        { type: 'KEYBOARD_TYPE', text: 'Best regards,\nKeybrix Team' },
        { type: 'DELAY', ms: 80 }
      ]
    }
  },
  {
    id: 'macro-screenshot-save',
    name: 'Screenshot + Save',
    description: 'Captures active window, optimizes as PNG, and uploads to cloud project folder.',
    shortcut: 'CTRL+S+S',
    isActive: false,
    status: 'PAUSED',
    blocksJson: {
      commands: [{ type: 'DELAY', ms: 100 }]
    }
  },
  {
    id: 'macro-docker-clean',
    name: 'Docker Clean',
    description: 'Stops all containers, prunes unused volumes, and restarts the core dev stack.',
    shortcut: 'ALT+F2',
    isActive: true,
    status: 'ACTIVE',
    blocksJson: {
      commands: [
        { type: 'KEYBOARD_TYPE', text: 'docker system prune -f' },
        { type: 'KEYBOARD_PRESS', key: 'Enter' }
      ]
    }
  }
]

export const MOCK_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    timestamp: hhmmss(0),
    level: 'RUN',
    message: "Macro 'Copy & Paste Pro' initialized successfully."
  },
  {
    id: 'log-2',
    timestamp: hhmmss(1),
    level: 'TRIG',
    message: 'Input detected: [CTRL+SHIFT+C] mapping to slot 0x42.'
  },
  {
    id: 'log-3',
    timestamp: hhmmss(4),
    level: 'INFO',
    message: 'KeyBrix Engine v2.4.0 background service is stable.'
  },
  {
    id: 'log-4',
    timestamp: hhmmss(7),
    level: 'WARN',
    message: "Memory pressure detected at logic node 'Image Processor'. Self-healing triggered."
  }
]

export const MOCK_BASE_STATS = {
  timeSavedMinutes: 720,
  totalRuns: 412,
  successfulRuns: 411
}
