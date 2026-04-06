import { z } from 'zod'
import en from './locales/en.json'
import pl from './locales/pl.json'

export const LanguageSchema = z.enum(['POLSKI', 'ENGLISH'])
export type Language = z.infer<typeof LanguageSchema>

type I18nVariables = Record<string, string | number | undefined>

type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}`
}[keyof T & string]

const flattenKeys = (obj: Record<string, unknown>, base = ''): string[] => {
  const keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const nextKey = base ? `${base}.${key}` : key

    if (typeof value === 'string') {
      keys.push(nextKey)
      continue
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, nextKey))
    }
  }

  return keys
}

const enKeys = flattenKeys(en)
const plKeys = flattenKeys(pl)

const missingInPolish = enKeys.filter((key) => !plKeys.includes(key))
const extraInPolish = plKeys.filter((key) => !enKeys.includes(key))

if (missingInPolish.length > 0 || extraInPolish.length > 0) {
  throw new Error(
    `Locale keys mismatch. Missing in pl: ${missingInPolish.join(', ')}. Extra in pl: ${extraInPolish.join(', ')}.`
  )
}

const dictionary = {
  POLSKI: pl,
  ENGLISH: en
} as const

export type I18nKey = keyof (typeof dictionary)['ENGLISH']

export type I18nPathKey = DotPath<(typeof dictionary)['ENGLISH']>

const getByPath = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, obj)
}

export const t = (language: Language, key: I18nPathKey, variables?: I18nVariables): string => {
  const template = getByPath(dictionary[language], key)

  if (typeof template !== 'string') {
    throw new Error(`Missing translation value for key '${key}' in language '${language}'.`)
  }

  if (!variables) {
    return template
  }

  return template.replace(/\{\{(.*?)\}\}/g, (_fullMatch, rawName) => {
    const name = String(rawName).trim()
    const value = variables[name]

    return value === undefined ? `{{${name}}}` : String(value)
  })
}
