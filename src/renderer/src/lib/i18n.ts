import { t as sharedTranslate } from '../../../shared/i18n'
import type { I18nPathKey, Language } from '../../../shared/i18n'

export const t = (
  language: Language,
  key: I18nPathKey,
  variables?: Record<string, string | number | undefined>
): string => {
  return sharedTranslate(language, key, variables)
}
