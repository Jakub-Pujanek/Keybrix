import { create } from 'zustand'

type UiState = {
  isSidebarCompact: boolean
  toggleSidebarCompact: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCompact: false,
  toggleSidebarCompact: () =>
    set((state) => ({
      isSidebarCompact: !state.isSidebarCompact
    }))
}))
