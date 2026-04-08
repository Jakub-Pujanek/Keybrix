import { Bell, CircleHelp } from 'lucide-react'
import CreateMacroButton from '../composites/macro/CreateMacroButton'
import CreateMacroModal from '../composites/macro/CreateMacroModal'
import Button from '../primitives/Button'
import {
  useActivityStore,
  useAppStore,
  useEditorStore,
  useMacroStore,
  useUiStore
} from '../../store'
import { useI18n } from '../../lib/useI18n'
import { useState } from 'react'

function Header(): React.JSX.Element {
  const systemStatus = useAppStore((state) => state.systemStatus)
  const activeScreen = useAppStore((state) => state.activeScreen)
  const setActiveScreen = useAppStore((state) => state.setActiveScreen)
  const logs = useActivityStore((state) => state.logs)

  const createMacro = useMacroStore((state) => state.createMacro)
  const loadMacros = useMacroStore((state) => state.loadMacros)

  const loadEditorMacro = useEditorStore((state) => state.loadEditorMacro)

  const isCreateMacroModalOpen = useUiStore((state) => state.isCreateMacroModalOpen)
  const isNotificationsPanelOpen = useUiStore((state) => state.isNotificationsPanelOpen)
  const isHelpPanelOpen = useUiStore((state) => state.isHelpPanelOpen)
  const openCreateMacroModal = useUiStore((state) => state.openCreateMacroModal)
  const closeCreateMacroModal = useUiStore((state) => state.closeCreateMacroModal)
  const toggleNotificationsPanel = useUiStore((state) => state.toggleNotificationsPanel)
  const closeNotificationsPanel = useUiStore((state) => state.closeNotificationsPanel)
  const toggleHelpPanel = useUiStore((state) => state.toggleHelpPanel)
  const closeHelpPanel = useUiStore((state) => state.closeHelpPanel)

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const { tx } = useI18n()
  const isEditor = activeScreen === 'editor'
  const isSettings = activeScreen === 'settings'
  const isWaylandGuide = activeScreen === 'wayland-guide'

  const title = isEditor
    ? tx('header.title.editor')
    : isSettings
      ? tx('header.title.settings')
      : isWaylandGuide
        ? tx('header.title.waylandGuide')
        : tx('header.title.dashboard')

  const badgeText = isEditor
    ? tx('header.badge.macroBuilder')
    : tx('header.badge.system', { status: systemStatus })

  return (
    <header className="relative flex items-center justify-between border-b border-[var(--kb-border)] px-6 py-4">
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
        <Button
          variant="icon"
          aria-label={tx('header.actions.notifications')}
          onClick={toggleNotificationsPanel}
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="icon" aria-label={tx('header.actions.help')} onClick={toggleHelpPanel}>
          <CircleHelp className="h-4 w-4" />
        </Button>
        <CreateMacroButton
          onClick={() => {
            setCreateError(null)
            openCreateMacroModal()
            closeNotificationsPanel()
            closeHelpPanel()
          }}
        />
      </div>

      {isNotificationsPanelOpen ? (
        <article className="absolute top-full right-20 z-[1200] mt-3 w-[360px] rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-surface)] p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--kb-text-main)]">Recent activity</h3>
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={closeNotificationsPanel}>
              Close
            </Button>
          </div>
          <ul className="space-y-2 text-xs text-[var(--kb-text-muted)]">
            {logs.slice(0, 5).map((log) => (
              <li key={log.id} className="rounded-md bg-[var(--kb-bg-overlay)] px-3 py-2">
                <p className="font-semibold text-[var(--kb-text-main)]">{log.level}</p>
                <p className="mt-1">{log.message}</p>
              </li>
            ))}
            {logs.length === 0 ? <li className="px-1 py-2">No activity yet.</li> : null}
          </ul>
        </article>
      ) : null}

      {isHelpPanelOpen ? (
        <article className="absolute top-full right-8 z-[1200] mt-3 w-[360px] rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-surface)] p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--kb-text-main)]">Quick help</h3>
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={closeHelpPanel}>
              Close
            </Button>
          </div>
          <ul className="space-y-2 text-xs text-[var(--kb-text-muted)]">
            <li>Create macros from Dashboard or header button.</li>
            <li>Use pencil on a macro card to open it in the editor.</li>
            <li>Record shortcut in editor top bar and save macro.</li>
            <li>Use Test Run to quickly validate a macro.</li>
          </ul>
        </article>
      ) : null}

      <CreateMacroModal
        isOpen={isCreateMacroModalOpen}
        isSubmitting={isSubmittingCreate}
        submitError={createError}
        onClose={() => {
          setCreateError(null)
          closeCreateMacroModal()
        }}
        onSubmit={async ({ name, openNow }) => {
          setIsSubmittingCreate(true)
          try {
            const created = await createMacro(name)
            await loadMacros()

            if (openNow) {
              await loadEditorMacro(created.id)
              setActiveScreen('editor')
            }

            closeCreateMacroModal()
            setCreateError(null)
          } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'Failed to create macro.')
          } finally {
            setIsSubmittingCreate(false)
          }
        }}
      />
    </header>
  )
}

export default Header
