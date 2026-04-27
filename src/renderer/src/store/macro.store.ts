import { create } from 'zustand'
import type { Macro, MacroStatus } from '../../../shared/api'
import { useEditorStore } from './editor.store'

type MacroState = {
  macros: Macro[]
  isLoading: boolean
  loadError: string | null
  loadMacros: () => Promise<void>
  createMacro: (name: string) => Promise<Macro>
  deleteMacro: (id: string) => Promise<boolean>
  setMacroActive: (id: string, isActive: boolean) => Promise<void>
  runMacroManually: (id: string) => Promise<void>
  stopMacroManually: (id: string) => Promise<void>
  subscribeMacroStatus: () => () => void
}

const shortcutTokens = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const normalizeShortcut = (value: string): string => value.replace(/\s*\+\s*/g, '+').toUpperCase()

const buildInitialShortcut = (macros: Macro[]): string => {
  const used = new Set(macros.map((macro) => normalizeShortcut(macro.shortcut)).filter(Boolean))

  for (const token of shortcutTokens) {
    const candidate = `CTRL+SHIFT+${token}`
    if (!used.has(candidate)) {
      return candidate
    }
  }

  return `CTRL+ALT+${Date.now().toString().slice(-4)}`
}

const mergeMacrosPreservingSwitchState = (incoming: Macro[], existing: Macro[]): Macro[] => {
  const activeById = new Map(existing.map((macro) => [macro.id, macro.isActive]))

  return incoming.map((macro) => {
    const preservedActive = activeById.get(macro.id)

    if (preservedActive === undefined) {
      return macro
    }

    return {
      ...macro,
      isActive: preservedActive
    }
  })
}

export const useMacroStore = create<MacroState>((set, get) => ({
  macros: [],
  isLoading: false,
  loadError: null,
  loadMacros: async () => {
    set({ isLoading: true, loadError: null })

    try {
      const macros = await window.api.macros.getAll()
      set((state) => ({
        macros: mergeMacrosPreservingSwitchState(macros, state.macros),
        isLoading: false,
        loadError: null
      }))
      useEditorStore.getState().ensureActiveMacroInvariant(macros.map((macro) => macro.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load macros.'
      console.error('[macro.store] loadMacros failed:', error)
      set({ macros: [], isLoading: false, loadError: message })
    }
  },
  createMacro: async (name) => {
    const trimmedName = name.trim()
    const safeName = trimmedName.length > 0 ? trimmedName.slice(0, 60) : 'Untitled Macro'

    const shortcut = buildInitialShortcut(get().macros)
    const saved = await window.api.macros.save({
      name: safeName,
      shortcut,
      isActive: false,
      status: 'IDLE',
      blocksJson: {
        zoom: 1,
        nodes: [
          {
            id: `node-start-${Date.now()}`,
            type: 'START',
            x: 220,
            y: 96,
            nextId: null,
            payload: {
              label: 'Start',
              shortcut: shortcut.replace(/\+/g, ' + ')
            }
          }
        ]
      }
    })

    set((state) => ({
      macros: [saved, ...state.macros]
    }))

    return saved
  },
  deleteMacro: async (id) => {
    const success = await window.api.macros.delete(id)
    if (!success) return false

    const remainingMacros = get().macros.filter((macro) => macro.id !== id)

    set({
      macros: remainingMacros
    })

    useEditorStore.getState().ensureActiveMacroInvariant(remainingMacros.map((macro) => macro.id))

    return true
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
  runMacroManually: async (id) => {
    await window.api.macros.runManually(id)
    await get().loadMacros()
  },
  stopMacroManually: async (id) => {
    await window.api.macros.stop(id)
  },
  subscribeMacroStatus: () => {
    const applyStatus = (id: string, newStatus: MacroStatus): void => {
      set((state) => ({
        macros: state.macros.map((macro) =>
          macro.id === id
            ? {
                ...macro,
                status: newStatus
              }
            : macro
        )
      }))
    }

    const off = window.api.system.onMacroStatusChange(applyStatus)
    return () => off()
  }
}))
