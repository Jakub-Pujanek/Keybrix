import { ElectronAPI } from '@electron-toolkit/preload'
import type { KeybrixApi } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: KeybrixApi
  }
}
