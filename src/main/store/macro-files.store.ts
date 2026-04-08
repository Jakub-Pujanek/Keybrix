import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { MacroSchema, type Macro } from '../../shared/api'

const MACRO_FILE_VERSION = 1 as const
const INDEX_FILE_VERSION = 1 as const
const INDEX_FILE_NAME = 'index.json'
const MAX_SLUG_LENGTH = 120

const WINDOWS_RESERVED_NAMES = new Set<string>([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
])

const StoredMacroSchema = MacroSchema.extend({
  version: z.literal(MACRO_FILE_VERSION),
  slug: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

type StoredMacro = z.infer<typeof StoredMacroSchema>

const MacroIndexEntrySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  fileName: z.string().min(1),
  updatedAt: z.string().datetime()
})

type MacroIndexEntry = z.infer<typeof MacroIndexEntrySchema>

const MacroIndexSchema = z.object({
  version: z.literal(INDEX_FILE_VERSION),
  macros: z.array(MacroIndexEntrySchema)
})

type MacroIndex = z.infer<typeof MacroIndexSchema>

export type MacroFilesRecord = {
  macro: Macro
  slug: string
  createdAt: string
  updatedAt: string
}

const toMacroFilesRecord = (stored: StoredMacro): MacroFilesRecord => {
  const macro: Macro = {
    id: stored.id,
    name: stored.name,
    description: stored.description,
    shortcut: stored.shortcut,
    isActive: stored.isActive,
    status: stored.status,
    blocksJson: stored.blocksJson
  }

  return {
    macro,
    slug: stored.slug,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt
  }
}

const trimSlug = (value: string): string => {
  if (value.length <= MAX_SLUG_LENGTH) return value
  return value.slice(0, MAX_SLUG_LENGTH)
}

const normalizeSlugBase = (name: string): string => {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const fallback = normalized.length > 0 ? normalized : 'macro'
  const trimmed = trimSlug(fallback)
  return trimmed.length > 0 ? trimmed : 'macro'
}

const ensureWindowsSafeSlug = (slug: string): string => {
  if (!WINDOWS_RESERVED_NAMES.has(slug.toLowerCase())) {
    return slug
  }

  const next = `${slug}-macro`
  return trimSlug(next)
}

const createSlug = (name: string): string => ensureWindowsSafeSlug(normalizeSlugBase(name))

const resolveSlugCollision = (
  preferredSlug: string,
  existingEntries: MacroIndexEntry[],
  exceptId?: string
): string => {
  const taken = new Set<string>()
  for (const entry of existingEntries) {
    if (exceptId && entry.id === exceptId) continue
    taken.add(entry.slug.toLowerCase())
  }

  let candidate = preferredSlug
  let suffix = 2

  while (taken.has(candidate.toLowerCase())) {
    const suffixToken = `-${suffix}`
    const maxBaseLength = Math.max(1, MAX_SLUG_LENGTH - suffixToken.length)
    const base = preferredSlug.slice(0, maxBaseLength)
    candidate = `${base}${suffixToken}`
    suffix += 1
  }

  return ensureWindowsSafeSlug(candidate)
}

const nowIso = (): string => new Date().toISOString()

const resolveUserDataPath = (): string => {
  const envPath = process.env['KEYBRIX_USER_DATA_DIR']
  if (envPath && envPath.trim().length > 0) {
    return envPath
  }

  if (typeof app?.getPath === 'function') {
    return app.getPath('userData')
  }

  return join(process.cwd(), '.keybrix-user-data')
}

const parseStoredMacro = (value: unknown): StoredMacro => StoredMacroSchema.parse(value)

export class MacroFilesStore {
  private readonly macrosDir: string

  constructor(options?: { userDataDir?: string }) {
    const baseDir = options?.userDataDir ?? resolveUserDataPath()
    this.macrosDir = join(baseDir, 'macros')
    this.ensureStorageReady()
  }

  list(): MacroFilesRecord[] {
    const index = this.loadIndexWithRecovery()

    return index.macros
      .map((entry) => {
        const path = this.resolveMacroFilePath(entry.fileName)
        const stored = this.readStoredMacro(path)
        if (!stored) return null
        return toMacroFilesRecord(stored)
      })
      .filter((value): value is MacroFilesRecord => value !== null)
  }

  readById(id: string): MacroFilesRecord | null {
    const index = this.loadIndexWithRecovery()
    const entry = index.macros.find((item) => item.id === id)
    if (!entry) return null

    const path = this.resolveMacroFilePath(entry.fileName)
    const stored = this.readStoredMacro(path)
    if (!stored) {
      this.rebuildIndexFromFiles()
      return null
    }

    return toMacroFilesRecord(stored)
  }

  create(macro: Macro): MacroFilesRecord {
    const index = this.loadIndexWithRecovery()
    if (index.macros.some((entry) => entry.id === macro.id)) {
      throw new Error(`Macro '${macro.id}' already exists.`)
    }

    const slug = resolveSlugCollision(createSlug(macro.name), index.macros)
    const fileName = `${slug}.json`
    const timestamp = nowIso()

    const stored = parseStoredMacro({
      ...macro,
      version: MACRO_FILE_VERSION,
      slug,
      createdAt: timestamp,
      updatedAt: timestamp
    })

    this.writeMacroAtomic(fileName, stored)

    const nextIndex: MacroIndex = {
      version: INDEX_FILE_VERSION,
      macros: [
        {
          id: stored.id,
          slug: stored.slug,
          fileName,
          updatedAt: stored.updatedAt
        },
        ...index.macros
      ]
    }

    this.writeIndexAtomic(nextIndex)
    return toMacroFilesRecord(stored)
  }

  update(id: string, nextMacro: Macro): MacroFilesRecord | null {
    const index = this.loadIndexWithRecovery()
    const currentEntry = index.macros.find((entry) => entry.id === id)
    if (!currentEntry) return null

    const currentPath = this.resolveMacroFilePath(currentEntry.fileName)
    const currentStored = this.readStoredMacro(currentPath)
    if (!currentStored) {
      this.rebuildIndexFromFiles()
      return null
    }

    const shouldRename = currentStored.name !== nextMacro.name
    const nextSlug = shouldRename
      ? resolveSlugCollision(createSlug(nextMacro.name), index.macros, id)
      : currentStored.slug

    const targetFileName = `${nextSlug}.json`
    const updated = parseStoredMacro({
      ...nextMacro,
      version: MACRO_FILE_VERSION,
      slug: nextSlug,
      createdAt: currentStored.createdAt,
      updatedAt: nowIso()
    })

    if (shouldRename && targetFileName !== currentEntry.fileName) {
      this.writeMacroAtomic(targetFileName, updated)

      const nextIndex = MacroIndexSchema.parse({
        version: INDEX_FILE_VERSION,
        macros: index.macros.map((entry) => {
          if (entry.id !== id) return entry
          return {
            id,
            slug: updated.slug,
            fileName: targetFileName,
            updatedAt: updated.updatedAt
          }
        })
      })

      this.writeIndexAtomic(nextIndex)
      rmSync(currentPath, { force: true })
      return toMacroFilesRecord(updated)
    }

    this.writeMacroAtomic(currentEntry.fileName, updated)
    const nextIndex = MacroIndexSchema.parse({
      version: INDEX_FILE_VERSION,
      macros: index.macros.map((entry) => {
        if (entry.id !== id) return entry
        return {
          ...entry,
          slug: updated.slug,
          updatedAt: updated.updatedAt
        }
      })
    })

    this.writeIndexAtomic(nextIndex)
    return toMacroFilesRecord(updated)
  }

  rename(id: string, name: string): MacroFilesRecord | null {
    const current = this.readById(id)
    if (!current) return null
    return this.update(id, {
      ...current.macro,
      name
    })
  }

  delete(id: string): boolean {
    const index = this.loadIndexWithRecovery()
    const currentEntry = index.macros.find((entry) => entry.id === id)
    if (!currentEntry) return false

    const nextIndex = MacroIndexSchema.parse({
      version: INDEX_FILE_VERSION,
      macros: index.macros.filter((entry) => entry.id !== id)
    })

    this.writeIndexAtomic(nextIndex)
    rmSync(this.resolveMacroFilePath(currentEntry.fileName), { force: true })
    return true
  }

  private ensureStorageReady(): void {
    mkdirSync(this.macrosDir, { recursive: true })
    const indexPath = this.resolveIndexPath()

    try {
      const raw = readFileSync(indexPath, 'utf8')
      MacroIndexSchema.parse(JSON.parse(raw))
    } catch {
      this.writeIndexAtomic({
        version: INDEX_FILE_VERSION,
        macros: []
      })
    }
  }

  private resolveIndexPath(): string {
    return join(this.macrosDir, INDEX_FILE_NAME)
  }

  private resolveMacroFilePath(fileName: string): string {
    return join(this.macrosDir, fileName)
  }

  private writeAtomic(filePath: string, payload: unknown): void {
    const tempPath = `${filePath}.${globalThis.crypto.randomUUID()}.tmp`
    const serialized = `${JSON.stringify(payload, null, 2)}\n`
    writeFileSync(tempPath, serialized, 'utf8')
    renameSync(tempPath, filePath)
  }

  private writeIndexAtomic(index: MacroIndex): void {
    this.writeAtomic(this.resolveIndexPath(), MacroIndexSchema.parse(index))
  }

  private writeMacroAtomic(fileName: string, macro: StoredMacro): void {
    this.writeAtomic(this.resolveMacroFilePath(fileName), StoredMacroSchema.parse(macro))
  }

  private readStoredMacro(path: string): StoredMacro | null {
    try {
      const raw = readFileSync(path, 'utf8')
      return StoredMacroSchema.parse(JSON.parse(raw))
    } catch {
      return null
    }
  }

  private loadIndexWithRecovery(): MacroIndex {
    const indexPath = this.resolveIndexPath()

    try {
      const raw = readFileSync(indexPath, 'utf8')
      return MacroIndexSchema.parse(JSON.parse(raw))
    } catch {
      return this.rebuildIndexFromFiles()
    }
  }

  private rebuildIndexFromFiles(): MacroIndex {
    const entries = readdirSync(this.macrosDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith('.json') && name !== INDEX_FILE_NAME)
      .map((fileName) => {
        const filePath = this.resolveMacroFilePath(fileName)
        const stored = this.readStoredMacro(filePath)
        if (!stored) return null

        const stats = statSync(filePath)
        return {
          id: stored.id,
          slug: stored.slug,
          fileName,
          updatedAt: stored.updatedAt,
          mtimeMs: stats.mtimeMs
        }
      })
      .filter(
        (
          value
        ): value is {
          id: string
          slug: string
          fileName: string
          updatedAt: string
          mtimeMs: number
        } => value !== null
      )
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        fileName: entry.fileName,
        updatedAt: entry.updatedAt
      }))

    const index = MacroIndexSchema.parse({
      version: INDEX_FILE_VERSION,
      macros: entries
    })

    this.writeIndexAtomic(index)
    return index
  }
}

export const macroFilesStore = new MacroFilesStore()
