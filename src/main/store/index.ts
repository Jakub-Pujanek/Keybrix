import ElectronStore from 'electron-store'
import { z } from 'zod'
import {
  ActivityLogSchema,
  MacroSchema,
  type ActivityLog,
  type Macro,
  type SaveMacroInput
} from '../../shared/api'

const Store = ((ElectronStore as unknown as { default?: typeof ElectronStore }).default ??
  ElectronStore) as typeof ElectronStore

const MainStatsCountersSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  successfulRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  timeSavedMinutes: z.number().int().nonnegative()
})

export type MainStatsCounters = z.infer<typeof MainStatsCountersSchema>

const MainStoreStateSchema = z.object({
  schemaVersion: z.literal(1),
  macros: z.object({
    byId: z.record(z.string(), MacroSchema),
    order: z.array(z.string())
  }),
  logs: z.object({
    buffer: z.array(ActivityLogSchema)
  }),
  stats: z.object({
    counters: MainStatsCountersSchema
  })
})

export type MainStoreState = z.infer<typeof MainStoreStateSchema>

export const INITIAL_MAIN_STORE_STATE: MainStoreState = {
  schemaVersion: 1,
  macros: {
    byId: {},
    order: []
  },
  logs: {
    buffer: []
  },
  stats: {
    counters: {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      timeSavedMinutes: 0
    }
  }
}

const MainStoreMigrationInputSchema = z
  .object({
    schemaVersion: z.number().optional(),
    macros: z
      .object({
        byId: z.record(z.string(), MacroSchema).optional(),
        order: z.array(z.string()).optional()
      })
      .optional(),
    logs: z
      .object({
        buffer: z.array(ActivityLogSchema).optional()
      })
      .optional(),
    stats: z
      .object({
        counters: MainStatsCountersSchema.partial().optional()
      })
      .optional()
  })
  .passthrough()

const normalizeMacrosOrder = (byId: Record<string, Macro>, order: string[]): string[] => {
  const uniqueOrder: string[] = []
  const seen = new Set<string>()

  for (const id of order) {
    if (!byId[id] || seen.has(id)) continue
    uniqueOrder.push(id)
    seen.add(id)
  }

  for (const id of Object.keys(byId)) {
    if (seen.has(id)) continue
    uniqueOrder.push(id)
    seen.add(id)
  }

  return uniqueOrder
}

const migrateState = (input: unknown): MainStoreState => {
  const parsed = MainStoreMigrationInputSchema.safeParse(input)
  if (!parsed.success) {
    return INITIAL_MAIN_STORE_STATE
  }

  const macrosById = parsed.data.macros?.byId ?? {}
  const macrosOrder = normalizeMacrosOrder(macrosById, parsed.data.macros?.order ?? [])

  return MainStoreStateSchema.parse({
    schemaVersion: 1,
    macros: {
      byId: macrosById,
      order: macrosOrder
    },
    logs: {
      buffer: parsed.data.logs?.buffer ?? []
    },
    stats: {
      counters: {
        totalRuns: parsed.data.stats?.counters?.totalRuns ?? 0,
        successfulRuns: parsed.data.stats?.counters?.successfulRuns ?? 0,
        failedRuns: parsed.data.stats?.counters?.failedRuns ?? 0,
        timeSavedMinutes: parsed.data.stats?.counters?.timeSavedMinutes ?? 0
      }
    }
  })
}

export class MainStore {
  private readonly store = new Store<{ state: MainStoreState }>({
    name: 'main',
    defaults: {
      state: INITIAL_MAIN_STORE_STATE
    }
  })

  constructor() {
    const migrated = migrateState(this.store.get('state'))
    this.store.set('state', migrated)
  }

  getState(): MainStoreState {
    const current = this.store.get('state')
    const parsed = MainStoreStateSchema.parse(current)
    return parsed
  }

  setState(next: MainStoreState): void {
    const parsed = MainStoreStateSchema.parse(next)
    this.store.set('state', parsed)
  }

  updateState(updater: (prev: MainStoreState) => MainStoreState): MainStoreState {
    const next = updater(this.getState())
    this.setState(next)
    return next
  }
}

const createMacroFromInput = (input: SaveMacroInput, existing: Macro | undefined): Macro => {
  const id = input.id ?? existing?.id ?? globalThis.crypto.randomUUID()

  return MacroSchema.parse({
    id,
    name: input.name ?? existing?.name ?? 'Untitled Macro',
    description: input.description ?? existing?.description,
    shortcut: input.shortcut ?? existing?.shortcut ?? 'UNASSIGNED',
    isActive: input.isActive ?? existing?.isActive ?? false,
    status: input.status ?? existing?.status ?? 'IDLE',
    blocksJson: input.blocksJson ?? existing?.blocksJson ?? { nodes: [], zoom: 1 }
  })
}

export const timestamp = (): string => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `[${hh}:${mm}:${ss}]`
}

export const createActivityLog = (input: Pick<ActivityLog, 'level' | 'message'>): ActivityLog => {
  return ActivityLogSchema.parse({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: timestamp(),
    level: input.level,
    message: input.message
  })
}

export const mainStore = new MainStore()

export const mainStoreHelpers = {
  createMacroFromInput
}
