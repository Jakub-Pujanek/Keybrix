import { create } from 'zustand'

type EditorState = {
  draftXml: string
  setDraftXml: (xml: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  draftXml: '',
  setDraftXml: (xml) => set({ draftXml: xml })
}))
