import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Macro } from '../../shared/api'

let testUserDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testUserDataDir)
  }
}))

const createMacro = (name: string, shortcut: string): Macro => ({
  id: globalThis.crypto.randomUUID(),
  name,
  shortcut,
  isActive: false,
  status: 'IDLE',
  blocksJson: { nodes: [], zoom: 1 }
})

describe('MacroFilesStore', () => {
  beforeEach(() => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'keybrix-macro-files-store-'))
    rmSync(testUserDataDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('supports create, update, read and delete', async () => {
    const { MacroFilesStore } = await import('./macro-files.store')
    const store = new MacroFilesStore()

    const created = store.create(createMacro('Alpha Macro', 'CTRL+SHIFT+A'))
    expect(created.slug).toBe('alpha-macro')
    expect(store.list()).toHaveLength(1)

    const updated = store.update(created.macro.id, {
      ...created.macro,
      name: 'Alpha Macro Updated',
      shortcut: 'CTRL+SHIFT+U'
    })

    expect(updated).not.toBeNull()
    expect(updated?.macro.shortcut).toBe('CTRL+SHIFT+U')
    expect(updated?.slug).toBe('alpha-macro-updated')

    const readById = store.readById(created.macro.id)
    expect(readById?.macro.name).toBe('Alpha Macro Updated')

    const deleted = store.delete(created.macro.id)
    expect(deleted).toBe(true)
    expect(store.readById(created.macro.id)).toBeNull()
  })

  it('handles slug collisions with numeric suffixes', async () => {
    const { MacroFilesStore } = await import('./macro-files.store')
    const store = new MacroFilesStore()

    const first = store.create(createMacro('Copy Paste', 'CTRL+1'))
    const second = store.create(createMacro('Copy   Paste', 'CTRL+2'))

    expect(first.slug).toBe('copy-paste')
    expect(second.slug).toBe('copy-paste-2')
  })

  it('rebuilds index when index file is corrupted', async () => {
    const { MacroFilesStore } = await import('./macro-files.store')
    const store = new MacroFilesStore()
    const created = store.create(createMacro('Recover Me', 'CTRL+R'))

    const indexPath = join(testUserDataDir, 'macros', 'index.json')
    writeFileSync(indexPath, '{ invalid json', 'utf8')

    const recovered = store.readById(created.macro.id)
    expect(recovered).not.toBeNull()

    const indexRaw = readFileSync(indexPath, 'utf8')
    expect(indexRaw.includes(created.macro.id)).toBe(true)
  })

  it('renames file when macro name changes and keeps lookup by id', async () => {
    const { MacroFilesStore } = await import('./macro-files.store')
    const store = new MacroFilesStore()

    const created = store.create(createMacro('Initial Name', 'CTRL+I'))
    const renamed = store.update(created.macro.id, {
      ...created.macro,
      name: 'Renamed Macro'
    })

    expect(renamed).not.toBeNull()
    expect(renamed?.slug).toBe('renamed-macro')

    const indexPath = join(testUserDataDir, 'macros', 'index.json')
    const indexRaw = readFileSync(indexPath, 'utf8')
    expect(indexRaw.includes('renamed-macro.json')).toBe(true)
    expect(indexRaw.includes('initial-name.json')).toBe(false)

    const byId = store.readById(created.macro.id)
    expect(byId?.macro.name).toBe('Renamed Macro')
  })
})
