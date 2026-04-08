import { create } from 'zustand'

type UiState = {
  isSidebarCompact: boolean
  isCreateMacroModalOpen: boolean
  isNotificationsPanelOpen: boolean
  isHelpPanelOpen: boolean
  toggleSidebarCompact: () => void
  openCreateMacroModal: () => void
  closeCreateMacroModal: () => void
  toggleNotificationsPanel: () => void
  closeNotificationsPanel: () => void
  toggleHelpPanel: () => void
  closeHelpPanel: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCompact: false,
  isCreateMacroModalOpen: false,
  isNotificationsPanelOpen: false,
  isHelpPanelOpen: false,
  toggleSidebarCompact: () =>
    set((state) => ({
      isSidebarCompact: !state.isSidebarCompact
    })),
  openCreateMacroModal: () =>
    set({
      isCreateMacroModalOpen: true
    }),
  closeCreateMacroModal: () =>
    set({
      isCreateMacroModalOpen: false
    }),
  toggleNotificationsPanel: () =>
    set((state) => ({
      isNotificationsPanelOpen: !state.isNotificationsPanelOpen,
      isHelpPanelOpen: false
    })),
  closeNotificationsPanel: () =>
    set({
      isNotificationsPanelOpen: false
    }),
  toggleHelpPanel: () =>
    set((state) => ({
      isHelpPanelOpen: !state.isHelpPanelOpen,
      isNotificationsPanelOpen: false
    })),
  closeHelpPanel: () =>
    set({
      isHelpPanelOpen: false
    })
}))
