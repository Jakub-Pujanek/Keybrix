import { globalShortcut } from 'electron'
import type { Macro } from '../../shared/api'

type TriggerMacro = (macroId: string) => void

export class ShortcutManager {
	private registered = new Map<string, string>()

	constructor(private readonly onTriggerMacro: TriggerMacro) {}

	registerAllActive(macros: Macro[]): void {
		this.unregisterAll()

		for (const macro of macros) {
			if (!macro.isActive) continue
			this.registerMacro(macro)
		}
	}

	registerMacro(macro: Macro): boolean {
		if (!macro.isActive || !macro.shortcut.trim()) return false

		const accelerator = this.normalizeShortcut(macro.shortcut)
		if (!accelerator) return false

		try {
			const registered = globalShortcut.register(accelerator, () => this.onTriggerMacro(macro.id))
			if (!registered) return false

			this.registered.set(macro.id, accelerator)
			return true
		} catch {
			return false
		}
	}

	unregisterMacro(macroId: string): void {
		const accelerator = this.registered.get(macroId)
		if (!accelerator) return

		globalShortcut.unregister(accelerator)
		this.registered.delete(macroId)
	}

	unregisterAll(): void {
		for (const accelerator of this.registered.values()) {
			globalShortcut.unregister(accelerator)
		}
		this.registered.clear()
	}

	dispose(): void {
		this.unregisterAll()
	}

	private normalizeShortcut(shortcut: string): string {
		const tokenMap: Record<string, string> = {
			CTRL: 'CommandOrControl',
			CONTROL: 'CommandOrControl',
			CMD: 'Command',
			COMMAND: 'Command',
			ALT: 'Alt',
			OPTION: 'Alt',
			SHIFT: 'Shift'
		}

		const normalized = shortcut
			.split('+')
			.map((chunk) => chunk.trim())
			.filter(Boolean)
			.map((token) => tokenMap[token.toUpperCase()] ?? token)

		return normalized.join('+')
	}
}
