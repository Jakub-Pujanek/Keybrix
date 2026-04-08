import { type EditorDocument, type Macro } from '../../shared/api'
import { macroFilesStore } from '../store/macro-files.store'
import { structuredLogger } from './structured-logger.service'

const MY_FIRST_MACRO_ID = 'macro-my-first'

const buildMyFirstMacroDocument = (): EditorDocument => {
  return {
    zoom: 1,
    nodes: [
      {
        id: 'node-start',
        type: 'START',
        x: 220,
        y: 72,
        nextId: 'node-press-key',
        payload: {
          label: 'Start',
          shortcut: 'CTRL + SHIFT + M'
        }
      },
      {
        id: 'node-press-key',
        type: 'PRESS_KEY',
        x: 220,
        y: 155,
        nextId: 'node-wait',
        payload: {
          label: 'Press Key',
          key: 'CTRL + C'
        }
      },
      {
        id: 'node-wait',
        type: 'WAIT',
        x: 220,
        y: 252,
        nextId: 'node-type',
        payload: {
          label: 'Wait',
          durationMs: 250
        }
      },
      {
        id: 'node-type',
        type: 'TYPE_TEXT',
        x: 220,
        y: 350,
        nextId: null,
        payload: {
          label: 'Type Text',
          text: 'Hello from Keybrix'
        }
      }
    ]
  }
}

const buildMyFirstMacro = (): Macro => {
  return {
    id: MY_FIRST_MACRO_ID,
    name: 'My First Macro',
    shortcut: 'CTRL+SHIFT+M',
    isActive: false,
    status: 'IDLE',
    blocksJson: buildMyFirstMacroDocument()
  }
}

export class MacroSeedService {
  ensureMyFirstMacro(): { created: boolean } {
    const existing = macroFilesStore.readById(MY_FIRST_MACRO_ID)
    if (existing) {
      return { created: false }
    }

    macroFilesStore.create(buildMyFirstMacro())

    structuredLogger.info('Seeded My First Macro.', {
      scope: 'macro.seed.phase3',
      macroId: MY_FIRST_MACRO_ID
    })

    return { created: true }
  }
}

export const macroSeedService = new MacroSeedService()
