import { Bell, CircleHelp } from 'lucide-react'
import CreateMacroButton from '../composites/macro/CreateMacroButton'
import Button from '../primitives/Button'
import { useAppStore } from '../../store'
import { useI18n } from '../../lib/useI18n'

function Header(): React.JSX.Element {
  const systemStatus = useAppStore((state) => state.systemStatus)
  const activeScreen = useAppStore((state) => state.activeScreen)
  const { tx } = useI18n()
  const isEditor = activeScreen === 'editor'
  const isSettings = activeScreen === 'settings'

  const title = isEditor
    ? tx('header.title.editor')
    : isSettings
      ? tx('header.title.settings')
      : tx('header.title.dashboard')

  const badgeText = isEditor
    ? tx('header.badge.macroBuilder')
    : tx('header.badge.system', { status: systemStatus })

  return (
    <header className="flex items-center justify-between border-b border-[var(--kb-border)] px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-[34px] font-semibold text-[var(--kb-text-main)]">{title}</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--kb-bg-overlay)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--kb-text-muted)] uppercase">
          <span
            className={`h-1.5 w-1.5 rounded-full ${systemStatus === 'OPTIMAL' ? 'bg-[rgb(var(--kb-accent-rgb))]' : 'bg-orange-400'}`}
          />
          {badgeText}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="icon" aria-label={tx('header.actions.notifications')}>
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="icon" aria-label={tx('header.actions.help')}>
          <CircleHelp className="h-4 w-4" />
        </Button>
        <CreateMacroButton />
      </div>
    </header>
  )
}

export default Header
