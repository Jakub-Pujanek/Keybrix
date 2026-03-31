import { Bell, CircleHelp } from 'lucide-react'
import CreateMacroButton from '../composites/macro/CreateMacroButton'
import Button from '../primitives/Button'
import { useAppStore } from '../../store'

function Header(): React.JSX.Element {
  const systemStatus = useAppStore((state) => state.systemStatus)

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-[34px] font-semibold text-white">Dashboard</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
          <span
            className={`h-1.5 w-1.5 rounded-full ${systemStatus === 'OPTIMAL' ? 'bg-[#3f86ff]' : 'bg-orange-400'}`}
          />
          System {systemStatus}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="icon" aria-label="Help">
          <CircleHelp className="h-4 w-4" />
        </Button>
        <CreateMacroButton />
      </div>
    </header>
  )
}

export default Header
