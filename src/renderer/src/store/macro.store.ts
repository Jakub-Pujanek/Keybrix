import { create } from 'zustand'
import type { Macro, MacroStatus } from '../../../shared/api'

type MacroState = {
  macros: Macro[]
  isLoading: boolean
  loadMacros: () => Promise<void>
  setMacroActive: (id: string, isActive: boolean) => Promise<void>
  subscribeMacroStatus: () => () => void
}

export const useMacroStore = create<MacroState>((set) => ({
  macros: [],
  isLoading: false,
  loadMacros: async () => {
    set({ isLoading: true })
    const macros = await window.api.macros.getAll()
    set({ macros, isLoading: false })
  },
  setMacroActive: async (id, isActive) => {
    const success = await window.api.macros.toggle(id, isActive)
    if (!success) return

    set((state) => ({
      macros: state.macros.map((macro) =>
        macro.id === id
          ? {
              ...macro,
              isActive,
              status: isActive ? 'ACTIVE' : 'IDLE'
            }
          : macro
      )
    }))
  },
  subscribeMacroStatus: () => {
    const applyStatus = (id: string, newStatus: MacroStatus): void => {
      set((state) => ({
        macros: state.macros.map((macro) =>
          macro.id === id
            ? {
                ...macro,
                status: newStatus,
                isActive: newStatus === 'RUNNING' || newStatus === 'ACTIVE'
              }
            : macro
        )
      }))
    }

    const off = window.api.system.onMacroStatusChange(applyStatus)
    return () => off()
  }
}))
