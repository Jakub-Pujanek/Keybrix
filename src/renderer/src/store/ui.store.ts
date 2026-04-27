import { create } from 'zustand'

type DeleteMacroConfirmTarget = {
  id: string
  name: string
}

type UiState = {
  isSidebarCompact: boolean
  isCreateMacroModalOpen: boolean
  isNotificationsPanelOpen: boolean
  isHelpPanelOpen: boolean
  deleteMacroConfirmTarget: DeleteMacroConfirmTarget | null
  toggleSidebarCompact: () => void
  openCreateMacroModal: () => void
  closeCreateMacroModal: () => void
  toggleNotificationsPanel: () => void
  closeNotificationsPanel: () => void
  toggleHelpPanel: () => void
  closeHelpPanel: () => void
  openDeleteMacroConfirm: (target: DeleteMacroConfirmTarget) => void
  closeDeleteMacroConfirm: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCompact: false,
  isCreateMacroModalOpen: false,
  isNotificationsPanelOpen: false,
  isHelpPanelOpen: false,
  deleteMacroConfirmTarget: null,
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
    }),
  openDeleteMacroConfirm: (target) =>
    set({
      deleteMacroConfirmTarget: target
    }),
  closeDeleteMacroConfirm: () =>
    set({
      deleteMacroConfirmTarget: null
    })
}))
