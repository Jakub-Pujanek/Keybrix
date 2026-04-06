import { useEffect } from 'react'
import type { AccentColor, ThemeMode } from '../../../shared/api'

const ACCENT_RGB: Record<AccentColor, string> = {
  blue: '47 121 255',
  orange: '255 130 31',
  violet: '138 91 255',
  green: '28 195 151'
}

export const useThemeSync = (themeMode: ThemeMode, accentColor: AccentColor): void => {
  useEffect(() => {
    const root = document.documentElement

    root.classList.remove('dark', 'light')
    root.classList.add(themeMode === 'DARK' ? 'dark' : 'light')

    const accentRgb = ACCENT_RGB[accentColor]
    root.style.setProperty('--kb-accent-rgb', accentRgb)
  }, [themeMode, accentColor])
}
