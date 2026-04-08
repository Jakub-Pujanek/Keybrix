import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Macro } from '../../shared/api'

let testUserDataDir = ''

class MockStore<T extends Record<string, unknown>> {
  private readonly data = new Map<string, unknown>()

  constructor(options: { defaults?: Partial<T> } = {}) {
    const defaults = options.defaults ?? {}
    for (const [key, value] of Object.entries(defaults)) {
      this.data.set(key, value)
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data.get(String(key)) as T[K]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data.set(String(key), value)
  }
}

vi.mock('electron-store', () => ({
  default: MockStore
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testUserDataDir)
  }
}))

const buildMacro = (id: string, name: string): Macro => ({
  id,
  name,
  shortcut: 'CTRL+SHIFT+M',
  isActive: false,
  status: 'IDLE',
  blocksJson: { nodes: [], zoom: 1 }
})

describe('MacroMigrationService', () => {
  beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-macro-migration-'))
    rmSync(testUserDataDir, { recursive: true, force: true })

    vi.resetModules()
    const { mainStore, INITIAL_MAIN_STORE_STATE } = await import('../store')
    mainStore.setState(INITIAL_MAIN_STORE_STATE)
  })

  it('migrates legacy macros from main store into macro files and clears legacy payload', async () => {
    const { mainStore } = await import('../store')
    const { macroMigrationService } = await import('./macro-migration.service')
    const { macroFilesStore } = await import('../store/macro-files.store')

    const first = buildMacro('legacy-1', 'Legacy One')
    const second = buildMacro('legacy-2', 'Legacy Two')

    mainStore.updateState((prev) => ({
      ...prev,
      macros: {
        byId: {
          [first.id]: first,
          [second.id]: second
        },
        order: [first.id, second.id]
      },
      macroStorageMigration: {
        status: 'PENDING',
        migratedCount: 0
      }
    }))

    const result = macroMigrationService.migrateLegacyMacrosFromMainStore()

    expect(result.migratedCount).toBe(2)
    expect(result.skippedCount).toBe(0)
    expect(new Set(macroFilesStore.list().map((record) => record.macro.id))).toEqual(
      new Set([first.id, second.id])
    )

    const nextState = mainStore.getState()
    expect(nextState.schemaVersion).toBe(2)
    expect(nextState.macros.order).toHaveLength(0)
    expect(Object.keys(nextState.macros.byId)).toHaveLength(0)
    expect(nextState.macroStorageMigration.status).toBe('COMPLETED')
    expect(nextState.macroStorageMigration.migratedCount).toBe(2)
    expect(nextState.macroStorageMigration.migratedAt).toBeTruthy()
  })

  it('is idempotent when migration is already completed', async () => {
    const { mainStore } = await import('../store')
    const { macroMigrationService } = await import('./macro-migration.service')

    mainStore.updateState((prev) => ({
      ...prev,
      macroStorageMigration: {
        status: 'COMPLETED',
        migratedAt: new Date().toISOString(),
        migratedCount: 1
      }
    }))

    const result = macroMigrationService.migrateLegacyMacrosFromMainStore()

    expect(result.migratedCount).toBe(0)
    expect(result.skippedCount).toBe(0)
    expect(mainStore.getState().macroStorageMigration.migratedCount).toBe(1)
  })

  it('skips legacy macro ids that already exist in file storage', async () => {
    const { mainStore } = await import('../store')
    const { macroMigrationService } = await import('./macro-migration.service')
    const { macroFilesStore } = await import('../store/macro-files.store')

    const existing = buildMacro('legacy-existing', 'Legacy Existing')
    const pending = buildMacro('legacy-new', 'Legacy New')

    macroFilesStore.create(existing)

    mainStore.updateState((prev) => ({
      ...prev,
      macros: {
        byId: {
          [existing.id]: existing,
          [pending.id]: pending
        },
        order: [existing.id, pending.id]
      },
      macroStorageMigration: {
        status: 'PENDING',
        migratedCount: 0
      }
    }))

    const result = macroMigrationService.migrateLegacyMacrosFromMainStore()

    expect(result.migratedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(macroFilesStore.list()).toHaveLength(2)
    expect(mainStore.getState().macroStorageMigration.migratedCount).toBe(1)
  })
})
