import { type Macro } from '../../shared/api'
import { mainStore } from '../store'
import { macroFilesStore } from '../store/macro-files.store'
import { structuredLogger } from './structured-logger.service'

type MigrationResult = {
  migratedCount: number
  skippedCount: number
}

const getLegacyMacros = (): Macro[] => {
  const state = mainStore.getState()
  return state.macros.order
    .map((id) => state.macros.byId[id])
    .filter((macro): macro is Macro => macro !== undefined)
}

export class MacroMigrationService {
  migrateLegacyMacrosFromMainStore(): MigrationResult {
    const state = mainStore.getState()
    if (state.macroStorageMigration.status === 'COMPLETED') {
      return {
        migratedCount: 0,
        skippedCount: 0
      }
    }

    const legacyMacros = getLegacyMacros()
    let migratedCount = 0
    let skippedCount = 0

    for (const legacyMacro of legacyMacros) {
      const existing = macroFilesStore.readById(legacyMacro.id)
      if (existing) {
        skippedCount += 1
        continue
      }

      macroFilesStore.create(legacyMacro)
      migratedCount += 1
    }

    mainStore.updateState((prev) => ({
      ...prev,
      schemaVersion: 2,
      macros: {
        byId: {},
        order: []
      },
      macroStorageMigration: {
        status: 'COMPLETED',
        migratedAt: new Date().toISOString(),
        migratedCount: prev.macroStorageMigration.migratedCount + migratedCount
      }
    }))

    structuredLogger.info('Legacy macro storage migration completed.', {
      scope: 'macro.migration.phase2',
      details: {
        migratedCount,
        skippedCount
      }
    })

    return {
      migratedCount,
      skippedCount
    }
  }
}

export const macroMigrationService = new MacroMigrationService()
