import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import Store from 'electron-store'
import {
	ActivityLogSchema,
	DashboardStatsSchema,
	type ActivityLog,
	type DashboardStats,
	type LogLevel,
	MacroSchema,
	type Macro,
	type MacroStatus,
	type SaveMacroInput
} from '../../shared/api'
import { MOCK_BASE_STATS, MOCK_LOGS, MOCK_MACROS } from './mockData'

interface PersistedStats {
	timeSavedMinutes: number
	totalRuns: number
	successfulRuns: number
}

interface PersistedData {
	macros: Record<string, Macro>
	logs: ActivityLog[]
	stats: PersistedStats
}

const MAX_LOGS = 100

const defaultData = (): PersistedData => ({
	macros: Object.fromEntries(MOCK_MACROS.map((macro) => [macro.id, macro])),
	logs: [...MOCK_LOGS],
	stats: { ...MOCK_BASE_STATS }
})

export class MacroStore extends EventEmitter {
	private readonly db: Store<PersistedData>

	private macros = new Map<string, Macro>()

	private logs: ActivityLog[] = []

	private stats: PersistedStats = { ...MOCK_BASE_STATS }

	constructor() {
		super()

		this.db = new Store<PersistedData>({
			name: 'keybrix',
			defaults: defaultData()
		})

		this.load()
	}

	getAllMacros(): Macro[] {
		return Array.from(this.macros.values())
	}

	getMacroById(id: string): Macro | null {
		return this.macros.get(id) ?? null
	}

	saveMacro(input: SaveMacroInput): Macro {
		const current = input.id ? this.macros.get(input.id) : null
		const id = input.id ?? randomUUID()

		const macro = MacroSchema.parse({
			id,
			name: input.name ?? current?.name ?? 'Untitled Macro',
			description: input.description ?? current?.description,
			shortcut: input.shortcut ?? current?.shortcut ?? '',
			isActive: input.isActive ?? current?.isActive ?? false,
			status: input.status ?? current?.status ?? 'IDLE',
			blocksJson: input.blocksJson ?? current?.blocksJson ?? { commands: [] }
		})

		this.macros.set(macro.id, macro)
		this.persist()
		return macro
	}

	deleteMacro(id: string): boolean {
		const deleted = this.macros.delete(id)
		if (deleted) {
			this.persist()
		}
		return deleted
	}

	toggleMacro(id: string, isActive: boolean): boolean {
		const macro = this.macros.get(id)
		if (!macro) return false

		macro.isActive = isActive
		if (!isActive && macro.status === 'ACTIVE') {
			macro.status = 'IDLE'
			this.emit('macro-status-changed', { id: macro.id, newStatus: macro.status })
		}

		this.macros.set(id, macro)
		this.persist()
		return true
	}

	setMacroStatus(id: string, newStatus: MacroStatus): void {
		const macro = this.macros.get(id)
		if (!macro) return

		macro.status = newStatus
		this.macros.set(id, macro)
		this.persist()
		this.emit('macro-status-changed', { id, newStatus })
	}

	addLog(level: LogLevel, message: string): ActivityLog {
		const log = ActivityLogSchema.parse({
			id: randomUUID(),
			timestamp: this.formatTimestamp(new Date()),
			level,
			message
		})

		this.logs.unshift(log)
		this.logs = this.logs.slice(0, MAX_LOGS)
		this.persist()
		this.emit('log', log)

		return log
	}

	getRecentLogs(limit = MAX_LOGS): ActivityLog[] {
		return this.logs.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)))
	}

	recordRun(success: boolean, estimatedMinutes = 1): void {
		this.stats.totalRuns += 1
		if (success) {
			this.stats.successfulRuns += 1
			this.stats.timeSavedMinutes += Math.max(0, Math.floor(estimatedMinutes))
		}
		this.persist()
	}

	getDashboardStats(): DashboardStats {
		const macros = this.getAllMacros()
		const activeNow = macros.filter(
			(macro) => macro.status === 'RUNNING' || macro.status === 'ACTIVE'
		).length

		const successRate =
			this.stats.totalRuns === 0
				? 100
				: Number(((this.stats.successfulRuns / this.stats.totalRuns) * 100).toFixed(1))

		return DashboardStatsSchema.parse({
			totalAutomations: macros.length,
			timeSavedMinutes: this.stats.timeSavedMinutes,
			successRate,
			activeNow
		})
	}

	private load(): void {
		const raw = this.db.store

		const fallback = defaultData()
		const macrosRaw = raw.macros ?? fallback.macros
		const logsRaw = raw.logs ?? fallback.logs
		const statsRaw = raw.stats ?? fallback.stats

		this.macros = new Map(
			Object.values(macrosRaw)
				.map((value) => MacroSchema.safeParse(value))
				.filter((result) => result.success)
				.map((result) => [result.data.id, result.data] as const)
		)

		this.logs = logsRaw
			.map((value) => ActivityLogSchema.safeParse(value))
			.filter((result) => result.success)
			.map((result) => result.data)
			.slice(0, MAX_LOGS)

		this.stats = {
			timeSavedMinutes: Math.max(0, Math.floor(statsRaw.timeSavedMinutes ?? 0)),
			totalRuns: Math.max(0, Math.floor(statsRaw.totalRuns ?? 0)),
			successfulRuns: Math.max(0, Math.floor(statsRaw.successfulRuns ?? 0))
		}

		this.persist()
	}

	private persist(): void {
		this.db.set('macros', Object.fromEntries(this.macros.entries()))
		this.db.set('logs', this.logs)
		this.db.set('stats', this.stats)
	}

	private formatTimestamp(date: Date): string {
		const hh = String(date.getHours()).padStart(2, '0')
		const mm = String(date.getMinutes()).padStart(2, '0')
		const ss = String(date.getSeconds()).padStart(2, '0')
		return `[${hh}:${mm}:${ss}]`
	}
}
