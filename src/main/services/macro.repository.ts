import { SaveMacroInputSchema, type Macro, type SaveMacroInput } from '../../shared/api'
import { mainStore, mainStoreHelpers, type MainStoreState } from '../store'

const mergeMacroSnapshot = (state: MainStoreState): Macro[] => {
  return state.macros.order
    .map((id) => state.macros.byId[id])
    .filter((macro): macro is Macro => !!macro)
}

export class MacroRepository {
  getAll(): Macro[] {
    return mergeMacroSnapshot(mainStore.getState())
  }

  getById(id: string): Macro | null {
    return mainStore.getState().macros.byId[id] ?? null
  }

  save(input: SaveMacroInput): Macro {
    const parsed = SaveMacroInputSchema.parse(input)

    let saved: Macro | null = null
    mainStore.updateState((prev) => {
      const existing = parsed.id ? prev.macros.byId[parsed.id] : undefined
      const nextMacro = mainStoreHelpers.createMacroFromInput(parsed, existing)
      saved = nextMacro

      const hasMacro = !!prev.macros.byId[nextMacro.id]
      const nextOrder = hasMacro ? prev.macros.order : [nextMacro.id, ...prev.macros.order]

      return {
        ...prev,
        macros: {
          byId: {
            ...prev.macros.byId,
            [nextMacro.id]: nextMacro
          },
          order: nextOrder
        }
      }
    })

    if (!saved) {
      throw new Error('Failed to save macro.')
    }

    return saved
  }

  delete(id: string): boolean {
    let wasDeleted = false

    mainStore.updateState((prev) => {
      if (!prev.macros.byId[id]) return prev
      wasDeleted = true

      const nextById = { ...prev.macros.byId }
      delete nextById[id]

      return {
        ...prev,
        macros: {
          byId: nextById,
          order: prev.macros.order.filter((macroId) => macroId !== id)
        }
      }
    })

    return wasDeleted
  }

  toggleActive(id: string, isActive: boolean): boolean {
    let wasUpdated = false

    mainStore.updateState((prev) => {
      const current = prev.macros.byId[id]
      if (!current) return prev
      wasUpdated = true

      return {
        ...prev,
        macros: {
          ...prev.macros,
          byId: {
            ...prev.macros.byId,
            [id]: {
              ...current,
              isActive,
              status: isActive ? 'ACTIVE' : 'IDLE'
            }
          }
        }
      }
    })

    return wasUpdated
  }

  updateRuntimeState(id: string, status: Macro['status'], isActive: boolean): Macro | null {
    let updated: Macro | null = null

    mainStore.updateState((prev) => {
      const current = prev.macros.byId[id]
      if (!current) return prev

      updated = {
        ...current,
        status,
        isActive
      }

      return {
        ...prev,
        macros: {
          ...prev.macros,
          byId: {
            ...prev.macros.byId,
            [id]: updated
          }
        }
      }
    })

    return updated
  }
}

export const macroRepository = new MacroRepository()
