import { Pencil, Play } from 'lucide-react'
import Button from '../../primitives/Button'
import ShortcutTag from '../../primitives/ShortcutTag'
import ToggleSwitch from '../../primitives/ToggleSwitch'

type MacroCardProps = {
  id: string
  name: string
  description?: string
  shortcut: string
  isActive: boolean
  status: string
  onToggle: (id: string, value: boolean) => void
}

function MacroCard({
  id,
  name,
  description,
  shortcut,
  isActive,
  status,
  onToggle
}: MacroCardProps): React.JSX.Element {
  return (
    <article
      data-testid="macro-card"
      className="rounded-xl border border-white/5 bg-gradient-to-b from-[#1b2233] to-[#161d2c] px-5 py-5 shadow-[0_14px_40px_-20px_rgba(16,28,59,0.9)]"
    >
      <div className="flex items-start justify-between">
        <ShortcutTag shortcut={shortcut} />
        <ToggleSwitch checked={isActive} onChange={(next) => onToggle(id, next)} />
      </div>

      <h3 className="mt-4 text-[33px]/[1.15] text-white font-semibold">{name}</h3>
      <p className="mt-2 min-h-12 text-[21px]/[1.45] text-slate-300">{description}</p>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-8 w-8 px-0">
            <Play className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-8 w-8 px-0">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-[11px] font-semibold tracking-[0.15em] text-[#99b5ff] uppercase">
          {status}
        </span>
      </div>
    </article>
  )
}

export default MacroCard
