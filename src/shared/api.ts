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

export const SessionTypeSchema = z.enum(['WAYLAND', 'X11', 'UNKNOWN'])
export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionDetectionSourceSchema = z.enum([
  'LOGINCTL',
  'XDG_SESSION_TYPE',
  'DESKTOP_SESSION',
  'XDG_SESSION_DESKTOP',
  'GDMSESSION',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'PROCESS_PLATFORM',
  'UNKNOWN'
])
export type SessionDetectionSource = z.infer<typeof SessionDetectionSourceSchema>

export const SessionDetectionConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export type SessionDetectionConfidence = z.infer<typeof SessionDetectionConfidenceSchema>

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
  runId: z.string().min(1).optional(),
  message: z.string().min(1)
})
export type ActivityLog = z.infer<typeof ActivityLogSchema>

export const AuditActionSchema = z.enum([
  'MACRO_RUN',
  'MACRO_RUN_BLOCKED',
  'SETTINGS_UPDATED',
  'MACRO_TOGGLED',
  'MACRO_DELETED'
])
export type AuditAction = z.infer<typeof AuditActionSchema>

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  action: AuditActionSchema,
  targetId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  meta: z.record(z.string(), z.unknown()).optional()
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

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
  'HOLD_KEY',
  'EXECUTE_SHORTCUT',
  'WAIT',
  'MOUSE_CLICK',
  'AUTOCLICKER_TIMED',
  'AUTOCLICKER_INFINITE',
  'MOVE_MOUSE_DURATION',
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

export const RuntimeCommandSchema = z.object({
  type: EditorBlockTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({})
})
export type RuntimeCommand = z.infer<typeof RuntimeCommandSchema>

export const RuntimeMacroDocumentSchema = z.object({
  commands: z.array(RuntimeCommandSchema),
  nodes: z.array(EditorNodeSchema).optional(),
  zoom: z.number().min(0.5).max(2).optional()
})
export type RuntimeMacroDocument = z.infer<typeof RuntimeMacroDocumentSchema>

export const RecordShortcutInputSchema = z.object({
  keys: z.string().min(1),
  source: z.enum(['topbar', 'start-block', 'press-key-block', 'execute-shortcut-block'])
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

export const RuntimeSessionInfoSchema = z.object({
  sessionType: SessionTypeSchema,
  rawSession: z.string().nullable(),
  detectedAt: z.string().datetime(),
  isInputInjectionSupported: z.boolean(),
  detectionSource: SessionDetectionSourceSchema,
  detectionConfidence: SessionDetectionConfidenceSchema
})
export type RuntimeSessionInfo = z.infer<typeof RuntimeSessionInfoSchema>

export const SessionDetectionSnapshotSchema = z.object({
  xdgSessionType: z.string().nullable(),
  waylandDisplay: z.string().nullable(),
  display: z.string().nullable(),
  desktopSession: z.string().nullable(),
  xdgSessionDesktop: z.string().nullable(),
  gdmSession: z.string().nullable(),
  sessionId: z.string().nullable(),
  loginctlSessionType: z.string().nullable()
})
export type SessionDetectionSnapshot = z.infer<typeof SessionDetectionSnapshotSchema>

export const SessionDetectionProbeSchema = z.object({
  step: z.string().min(1),
  signal: z.string().nullable(),
  matched: z.boolean(),
  note: z.string().min(1)
})
export type SessionDetectionProbe = z.infer<typeof SessionDetectionProbeSchema>

export const SessionDiagnosticsSchema = z.object({
  sessionInfo: RuntimeSessionInfoSchema,
  snapshot: SessionDetectionSnapshotSchema,
  probes: z.array(SessionDetectionProbeSchema)
})
export type SessionDiagnostics = z.infer<typeof SessionDiagnosticsSchema>

export const SessionCheckResultSchema = z.object({
  previousSessionType: SessionTypeSchema,
  sessionInfo: RuntimeSessionInfoSchema,
  changed: z.boolean()
})
export type SessionCheckResult = z.infer<typeof SessionCheckResultSchema>

export const MousePickerPointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  timestamp: z.string().datetime()
})
export type MousePickerPoint = z.infer<typeof MousePickerPointSchema>

export const MousePickerPreviewSchema = MousePickerPointSchema.extend({
  isActive: z.boolean()
})
export type MousePickerPreview = z.infer<typeof MousePickerPreviewSchema>

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

export const UpdateAppSettingsInputSchema = AppSettingsSchema.partial().superRefine(
  (value, context) => {
    if (Object.keys(value).length > 0) {
      return
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one settings field must be provided.'
    })
  }
)
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsInputSchema>

export const MacroRunNotificationInputSchema = z.object({
  macroName: z.string().min(1)
})
export type MacroRunNotificationInput = z.infer<typeof MacroRunNotificationInputSchema>

export const ManualRunReasonCodeSchema = z.enum([
  'SUCCESS',
  'SAVE_FAILED',
  'ALREADY_RUNNING',
  'NOT_RUNNING',
  'MACRO_NOT_FOUND',
  'INVALID_MACRO_ID',
  'GLOBAL_MASTER_OFF',
  'WAYLAND_BLOCKED',
  'COMPILE_ERROR',
  'ABORTED',
  'COMMAND_TIMEOUT',
  'COMMAND_ERROR',
  'RUNNER_FAILED',
  'IPC_ERROR',
  'UNKNOWN'
])
export type ManualRunReasonCode = z.infer<typeof ManualRunReasonCodeSchema>

export const ManualRunResultSchema = z.object({
  runId: z.string().min(1),
  success: z.boolean(),
  reasonCode: ManualRunReasonCodeSchema,
  debugMessage: z.string().min(1).optional()
})
export type ManualRunResult = z.infer<typeof ManualRunResultSchema>

export const RunMacroRequestSchema = z.object({
  id: z.string().min(1),
  attemptId: z.string().min(1).optional()
})
export type RunMacroRequest = z.infer<typeof RunMacroRequestSchema>

export const IPC_CHANNELS = {
  macros: {
    getAll: 'macros:get-all',
    getById: 'macros:get-by-id',
    save: 'macros:save',
    delete: 'macros:delete',
    toggle: 'macros:toggle',
    run: 'macros:run',
    stop: 'macros:stop'
  },
  stats: {
    get: 'stats:get'
  },
  logs: {
    getRecent: 'logs:get-recent',
    newLog: 'logs:new-log'
  },
  mousePicker: {
    start: 'mouse-picker:start',
    stop: 'mouse-picker:stop',
    previewUpdate: 'mouse-picker:preview-update',
    coordinateSelected: 'mouse-picker:coordinate-selected'
  },
  system: {
    getSessionInfo: 'system:get-session-info',
    getSessionDiagnostics: 'system:get-session-diagnostics',
    refreshSessionInfo: 'system:refresh-session-info',
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
    runManually: (id: string, context?: { attemptId?: string }) => Promise<ManualRunResult>
    stop: (id: string, context?: { attemptId?: string }) => Promise<ManualRunResult>
  }
  stats: {
    getDashboardStats: () => Promise<DashboardStats>
  }
  logs: {
    getRecent: () => Promise<ActivityLog[]>
    onNewLog: (callback: (log: ActivityLog) => void) => () => void
  }
  mousePicker: {
    start: () => Promise<boolean>
    stop: () => Promise<boolean>
    onPreviewUpdate: (callback: (preview: MousePickerPreview) => void) => () => void
    onCoordinateSelected: (callback: (point: MousePickerPoint) => void) => () => void
  }
  system: {
    getSessionInfo: () => Promise<RuntimeSessionInfo>
    getSessionDiagnostics: () => Promise<SessionDiagnostics>
    refreshSessionInfo: () => Promise<SessionCheckResult>
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
