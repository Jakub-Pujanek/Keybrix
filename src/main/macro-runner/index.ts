import type { Macro } from '../../shared/api'
import { MacroStore } from '../store'

interface MacroCommand {
	type: string
	ms?: number
}

const wait = async (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms)
	})

export class MacroRunner {
	private running = new Set<string>()

	constructor(private readonly macroStore: MacroStore) {}

	async runMacroById(id: string): Promise<void> {
		const macro = this.macroStore.getMacroById(id)
		if (!macro) {
			this.macroStore.addLog('WARN', `Macro with id '${id}' not found.`)
			return
		}

		await this.runMacro(macro)
	}

	async runMacro(macro: Macro): Promise<void> {
		if (this.running.has(macro.id)) {
			this.macroStore.addLog('WARN', `Macro '${macro.name}' is already running.`)
			return
		}

		this.running.add(macro.id)
		this.macroStore.setMacroStatus(macro.id, 'RUNNING')
		this.macroStore.addLog('RUN', `Macro '${macro.name}' started.`)

		try {
			const commands = this.extractCommands(macro)
			await this.executeCommands(commands)

			this.macroStore.recordRun(true, 2)
			this.macroStore.addLog('INFO', `Macro '${macro.name}' completed.`)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown macro execution error.'
			this.macroStore.recordRun(false, 0)
			this.macroStore.addLog('ERR', `Macro '${macro.name}' failed: ${message}`)
		} finally {
			const latest = this.macroStore.getMacroById(macro.id)
			const nextStatus = latest?.isActive ? 'ACTIVE' : 'IDLE'

			this.macroStore.setMacroStatus(macro.id, nextStatus)
			this.running.delete(macro.id)
		}
	}

	private extractCommands(macro: Macro): MacroCommand[] {
		const candidate = macro.blocksJson as { commands?: MacroCommand[] }

		if (!Array.isArray(candidate.commands) || candidate.commands.length === 0) {
			return [{ type: 'DELAY', ms: 250 }]
		}

		return candidate.commands
	}

	private async executeCommands(commands: MacroCommand[]): Promise<void> {
		for (const command of commands) {
			switch (command.type) {
				case 'DELAY': {
					await wait(Math.max(0, command.ms ?? 100))
					break
				}
				case 'MOUSE_MOVE_TO':
				case 'MOUSE_CLICK':
				case 'KEYBOARD_TYPE':
				case 'KEYBOARD_PRESS': {
					// Mock execution path; real hardware integration with nut.js is added later.
					await wait(80)
					break
				}
				default: {
					await wait(30)
					break
				}
			}
		}
	}
}
