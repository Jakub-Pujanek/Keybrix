import { z } from 'zod'

export const MacroStatusSchema = z.enum(['RUNNING', 'IDLE', 'ACTIVE', 'PAUSED'])
export type MacroStatus = z.infer<typeof MacroStatusSchema>

export const LogLevelSchema = z.enum(['RUN', 'TRIG', 'INFO', 'WARN', 'ERR'])
export type LogLevel = z.infer<typeof LogLevelSchema>

export const SystemStatusSchema = z.enum(['OPTIMAL', 'DEGRADED'])
export type SystemStatus = z.infer<typeof SystemStatusSchema>

export const MacroSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  shortcut: z.string(),
  isActive: z.boolean(),
  status: MacroStatusSchema,
  blocksJson: z.record(z.string(), z.unknown())
})
export type Macro = z.infer<typeof MacroSchema>

export const ActivityLogSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  level: LogLevelSchema,
  message: z.string().min(1)
})
export type ActivityLog = z.infer<typeof ActivityLogSchema>

export const DashboardStatsSchema = z.object({
  totalAutomations: z.number().int().nonnegative(),
  timeSavedMinutes: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
  activeNow: z.number().int().nonnegative()
})
export type DashboardStats = z.infer<typeof DashboardStatsSchema>

export const SaveMacroInputSchema = MacroSchema.partial().extend({
  id: z.string().optional()
})
export type SaveMacroInput = z.infer<typeof SaveMacroInputSchema>

export const ToggleMacroInputSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean()
})
export type ToggleMacroInput = z.infer<typeof ToggleMacroInputSchema>

export const MacroStatusChangeEventSchema = z.object({
  id: z.string().min(1),
  newStatus: MacroStatusSchema
})
export type MacroStatusChangeEvent = z.infer<typeof MacroStatusChangeEventSchema>

export const EditorBlockTypeSchema = z.enum([
  'START',
  'PRESS_KEY',
  'WAIT',
  'MOUSE_CLICK',
  'TYPE_TEXT',
  'REPEAT',
  'INFINITE_LOOP'
])
export type EditorBlockType = z.infer<typeof EditorBlockTypeSchema>

export const EditorNodeSchema = z.object({
  id: z.string().min(1),
  type: EditorBlockTypeSchema,
  x: z.number(),
  y: z.number(),
  nextId: z.string().min(1).nullable().optional(),
  payload: z.record(z.string(), z.unknown())
})
export type EditorNode = z.infer<typeof EditorNodeSchema>

export const EditorDocumentSchema = z.object({
  nodes: z.array(EditorNodeSchema),
  zoom: z.number().min(0.5).max(2)
})
export type EditorDocument = z.infer<typeof EditorDocumentSchema>

export const RecordShortcutInputSchema = z.object({
  keys: z.string().min(1),
  source: z.enum(['topbar', 'start-block', 'press-key-block'])
})
export type RecordShortcutInput = z.infer<typeof RecordShortcutInputSchema>

export const IPC_CHANNELS = {
  macros: {
    getAll: 'macros:get-all',
    getById: 'macros:get-by-id',
    save: 'macros:save',
    delete: 'macros:delete',
    toggle: 'macros:toggle',
    run: 'macros:run'
  },
  stats: {
    get: 'stats:get'
  },
  logs: {
    getRecent: 'logs:get-recent',
    newLog: 'logs:new-log'
  },
  system: {
    statusUpdate: 'system:status-update',
    macroStatusChanged: 'system:macro-status-changed'
  },
  keyboard: {
    recordShortcut: 'keyboard:record-shortcut'
  }
} as const

export interface KeybrixApi {
  macros: {
    getAll: () => Promise<Macro[]>
    getById: (id: string) => Promise<Macro | null>
    save: (macro: SaveMacroInput) => Promise<Macro>
    delete: (id: string) => Promise<boolean>
    toggle: (id: string, isActive: boolean) => Promise<boolean>
    runManually: (id: string) => Promise<void>
  }
  stats: {
    getDashboardStats: () => Promise<DashboardStats>
  }
  logs: {
    getRecent: () => Promise<ActivityLog[]>
    onNewLog: (callback: (log: ActivityLog) => void) => () => void
  }
  system: {
    onStatusUpdate: (callback: (status: SystemStatus) => void) => () => void
    onMacroStatusChange: (callback: (id: string, newStatus: MacroStatus) => void) => () => void
  }
  keyboard: {
    recordShortcut: (input: RecordShortcutInput) => Promise<boolean>
  }
}
