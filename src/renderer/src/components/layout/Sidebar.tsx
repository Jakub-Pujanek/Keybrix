import { Database, House, Settings, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store'
import { useI18n } from '../../lib/useI18n'

const navItems = [
  { key: 'dashboard', icon: House, labelKey: 'nav.dashboard' },
  { key: 'editor', icon: Sparkles, labelKey: 'nav.editor' },
  { key: 'settings', icon: Settings, labelKey: 'nav.settings' },
  { key: 'storage', icon: Database, labelKey: 'nav.storage' }
] as const

function Sidebar(): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)
  const setActiveScreen = useAppStore((state) => state.setActiveScreen)
  const { tx } = useI18n()

  return (
    <aside className="flex w-[72px] flex-col items-center border-r border-white/10 bg-[#111827]/70 py-3">
      <div className="mb-6 h-9 w-9 rounded-md bg-gradient-to-br from-[#8ab4ff] to-[#f07d2f] text-[11px] font-bold text-[#111827] grid place-items-center">
        KB
      </div>

      <nav className="flex flex-col items-center gap-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeScreen === item.key
          const isRealScreen =
            item.key === 'dashboard' || item.key === 'editor' || item.key === 'settings'

          return (
            <button
              key={item.key}
              type="button"
              title={tx(item.labelKey)}
              onClick={() => {
                if (isRealScreen) setActiveScreen(item.key)
              }}
              className={`grid h-9 w-9 place-items-center rounded-md border transition ${isActive ? 'border-[#2f79ff] bg-[#1e2a43] text-[#9db8ff]' : 'border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
