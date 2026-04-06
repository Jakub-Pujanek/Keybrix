import { useMemo } from 'react'
import { useSettingsStore } from '../store'
import { t } from './i18n'
import type { I18nPathKey } from '../../../shared/i18n'

export const useI18n = (): {
  language: 'POLSKI' | 'ENGLISH'
  tx: (key: I18nPathKey, variables?: Record<string, string | number | undefined>) => string
} => {
  const appSettings = useSettingsStore((state) => state.appSettings)
  const language = useSettingsStore((state) => state.language)

  const effectiveLanguage = appSettings?.language ?? language

  const tx = useMemo(() => {
    return (key: I18nPathKey, variables?: Record<string, string | number | undefined>): string =>
      t(effectiveLanguage, key, variables)
  }, [effectiveLanguage])

  return {
    language: effectiveLanguage,
    tx
  }
}
