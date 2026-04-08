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
  status: string
  onToggle: (id: string, value: boolean) => void
  onRun: (id: string) => void
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
  onEdit,
  onDelete
}: MacroCardProps): React.JSX.Element {
  const { tx } = useI18n()
  const statusKey = `macro.status.${status}` as `macro.status.${MacroStatus}`

  return (
    <article
      data-testid="macro-card"
      className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-surface)] px-5 py-5 shadow-[0_14px_40px_-20px_rgba(16,28,59,0.45)]"
    >
      <div className="flex items-start justify-between">
        <ShortcutTag shortcut={shortcut} />
        <ToggleSwitch checked={isActive} onChange={(next) => onToggle(id, next)} />
      </div>

      <h3 className="mt-4 text-[33px]/[1.15] text-[var(--kb-text-main)] font-semibold">{name}</h3>
      <p className="mt-2 min-h-12 text-[21px]/[1.45] text-[var(--kb-text-muted)]">{description}</p>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 px-0"
            onClick={() => {
              onRun(id)
            }}
            aria-label={tx('macro.run')}
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-8 px-0"
            onClick={() => {
              onEdit(id)
            }}
            aria-label="Edit macro"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-8 px-0"
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
