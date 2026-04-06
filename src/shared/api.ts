import { z } from 'zod'
import { LanguageSchema } from './i18n'

export const ThemeModeSchema = z.enum(['DARK', 'LIGHT'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const AccentColorSchema = z.enum(['blue', 'orange', 'violet', 'green'])
export type AccentColor = z.infer<typeof AccentColorSchema>

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

export const AppSettingsSchema = z.object({
  launchAtStartup: z.boolean(),
  minimizeToTrayOnClose: z.boolean(),
  notifyOnMacroRun: z.boolean(),
  language: LanguageSchema,
  globalMaster: z.boolean(),
  delayMs: z.number().int().min(0).max(10_000),
  stopOnError: z.boolean(),
  themeMode: ThemeModeSchema,
  accentColor: AccentColorSchema
})
export type AppSettings = z.infer<typeof AppSettingsSchema>

export const DEFAULT_APP_SETTINGS: AppSettings = {
  launchAtStartup: true,
  minimizeToTrayOnClose: true,
  notifyOnMacroRun: true,
  language: 'POLSKI',
  globalMaster: true,
  delayMs: 0,
  stopOnError: true,
  themeMode: 'DARK',
  accentColor: 'blue'
}

const PartialAppSettingsSchema = AppSettingsSchema.partial()

export const coerceAppSettings = (input: unknown): AppSettings => {
  const partial = PartialAppSettingsSchema.parse(input)
  return AppSettingsSchema.parse({
    ...DEFAULT_APP_SETTINGS,
    ...partial
  })
}

export const UpdateAppSettingsInputSchema = AppSettingsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one settings field must be provided.'
  }
)
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsInputSchema>

export const MacroRunNotificationInputSchema = z.object({
  macroName: z.string().min(1)
})
export type MacroRunNotificationInput = z.infer<typeof MacroRunNotificationInputSchema>

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
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  notifications: {
    macroRun: 'notifications:macro-run'
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
  settings: {
    get: () => Promise<AppSettings>
    update: (input: UpdateAppSettingsInput) => Promise<AppSettings>
  }
}
