import { SaveMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { mainStoreHelpers } from '../store'
import { macroFilesStore } from '../store/macro-files.store'
import { macroSeedService } from './macro-seed.service'

export class MacroRepository {
  getAll(): Macro[] {
    const listed = macroFilesStore.list()
    if (listed.length > 0) {
      return listed.map((record) => record.macro)
    }

    macroSeedService.ensureMyFirstMacro()
    return macroFilesStore.list().map((record) => record.macro)
  }

  getById(id: string): Macro | null {
    return macroFilesStore.readById(id)?.macro ?? null
  }

  save(input: SaveMacroInput): Macro {
    const parsed = SaveMacroInputSchema.parse(input)

    const existing = parsed.id ? macroFilesStore.readById(parsed.id)?.macro : undefined
    const nextMacro = mainStoreHelpers.createMacroFromInput(parsed, existing)

    if (existing) {
      const updated = macroFilesStore.update(nextMacro.id, nextMacro)
      if (!updated) {
        throw new Error('Failed to save macro.')
      }
      return updated.macro
    }

    return macroFilesStore.create(nextMacro).macro
  }

  delete(id: string): boolean {
    return macroFilesStore.delete(id)
  }

  toggleActive(id: string, isActive: boolean): boolean {
    const current = macroFilesStore.readById(id)
    if (!current) return false

    const updated = macroFilesStore.update(id, {
      ...current.macro,
      isActive,
      status: isActive ? 'ACTIVE' : 'IDLE'
    })

    return updated !== null
  }

  updateRuntimeState(id: string, status: Macro['status']): Macro | null {
    const current = macroFilesStore.readById(id)
    if (!current) return null

    return (
      macroFilesStore.update(id, {
        ...current.macro,
        status
      })?.macro ?? null
    )
  }
}

export const macroRepository = new MacroRepository()
