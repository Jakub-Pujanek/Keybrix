import { Pencil, Play, Trash2 } from 'lucide-react'
import Button from '../../primitives/Button'
import ShortcutTag from '../../primitives/ShortcutTag'
import ToggleSwitch from '../../primitives/ToggleSwitch'
import { useI18n } from '../../../lib/useI18n'
import type { MacroStatus } from '../../../../../shared/api'

type MacroCardProps = {
  id: string
  name: string
  description?: string
  shortcut: string
  isActive: boolean
  status: MacroStatus
  onToggle: (id: string, value: boolean) => void
  onRun: (id: string) => void
  onStop: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function MacroCard({
  id,
  name,
  description,
  shortcut,
  isActive,
  status,
  onToggle,
  onRun,
  onStop,
  onEdit,
  onDelete
}: MacroCardProps): React.JSX.Element {
  const { tx } = useI18n()
  const statusKey = `macro.status.${status}` as `macro.status.${MacroStatus}`
  const isRunning = status === 'RUNNING'

  return (
    <article
      data-testid="macro-card"
      className="rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) px-5 py-5 shadow-[0_14px_40px_-20px_rgba(16,28,59,0.45)]"
    >
      <div className="flex items-start justify-between">
        <ShortcutTag shortcut={shortcut} />
        <ToggleSwitch checked={isActive} onChange={(next) => onToggle(id, next)} />
      </div>

      <h3 className="mt-4 text-[33px]/[1.15] text-(--kb-text-main) font-semibold">{name}</h3>
      <p className="mt-2 min-h-12 text-[21px]/[1.45] text-(--kb-text-muted)">{description}</p>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className={`flex h-9 items-center gap-2 px-3 rounded-md border transition active:scale-95 ${isRunning ? 'border-[rgb(var(--kb-accent-rgb))] bg-[rgb(var(--kb-accent-rgb)/0.18)] text-[rgb(var(--kb-accent-rgb))]' : 'border-transparent bg-transparent text-(--kb-text-muted) hover:bg-(--kb-bg-overlay) hover:text-(--kb-text-main)'}`}
            onClick={() => {
              if (isRunning) {
                onStop(id)
                return
              }

              onRun(id)
            }}
            aria-label={isRunning ? 'Stop macro run' : tx('macro.run')}
          >
            <span className="relative grid h-4 w-4 place-items-center">
              <Play
                className={`absolute h-4 w-4 stroke-[2.5px] transition-all duration-300 cubic-bezier(0.34,1.56,0.64,1) ${isRunning ? 'scale-0 opacity-0 -rotate-90' : 'translate-x-px scale-100 opacity-100 rotate-0'}`}
              />
              <div
                className={`absolute h-3 w-3 rounded-xs bg-current transition-all duration-300 cubic-bezier(0.34,1.56,0.64,1) ${isRunning ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90'}`}
              />
            </span>
            <span className="text-sm font-semibold transition-colors duration-200">
              {isRunning ? 'Stop' : 'Run'}
            </span>
          </Button>
          <Button
            variant="ghost"
            className="grid h-9 w-9 place-items-center rounded-md border border-transparent bg-transparent p-0 text-(--kb-text-muted) transition hover:bg-(--kb-bg-overlay) hover:text-(--kb-text-main)"
            onClick={() => {
              onEdit(id)
            }}
            aria-label="Edit macro"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="grid h-9 w-9 place-items-center rounded-md border border-transparent bg-transparent p-0 text-(--kb-text-muted) transition hover:bg-(--kb-bg-overlay) hover:text-(--kb-text-main)"
            onClick={() => {
              onDelete(id)
            }}
            aria-label="Delete macro"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-[11px] font-semibold tracking-[0.15em] text-[rgb(var(--kb-accent-rgb))] uppercase">
          {tx(statusKey)}
        </span>
      </div>
    </article>
  )
}

export default MacroCard
