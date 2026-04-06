import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import RecentActivityLogs from '../composites/activity/RecentActivityLogs'
import MacroCard from '../composites/macro/MacroCard'
import StatCard from '../composites/StatCard'
import { useActivityStore, useAppStore, useMacroStore } from '../../store'
import { useI18n } from '../../lib/useI18n'

const formatTimeSaved = (minutes: number): string => {
  const hours = Math.round(minutes / 60)
  return `${hours}h`
}

const formatRate = (rate: number): string => `${rate.toFixed(1)}%`

function DashboardScreen(): React.JSX.Element {
  const { tx } = useI18n()
  const stats = useAppStore((state) => state.dashboardStats)
  const loadDashboardStats = useAppStore((state) => state.loadDashboardStats)
  const subscribeSystemStatus = useAppStore((state) => state.subscribeSystemStatus)

  const macros = useMacroStore((state) => state.macros)
  const loadMacros = useMacroStore((state) => state.loadMacros)
  const setMacroActive = useMacroStore((state) => state.setMacroActive)
  const runMacroManually = useMacroStore((state) => state.runMacroManually)
  const subscribeMacroStatus = useMacroStore((state) => state.subscribeMacroStatus)

  const logs = useActivityStore((state) => state.logs)
  const loadRecentLogs = useActivityStore((state) => state.loadRecentLogs)
  const subscribeRealtimeLogs = useActivityStore((state) => state.subscribeRealtimeLogs)

  useEffect(() => {
    void loadDashboardStats()
    void loadMacros()
    void loadRecentLogs()

    const offLogs = subscribeRealtimeLogs()
    const offSystem = subscribeSystemStatus()
    const offMacros = subscribeMacroStatus()

    return () => {
      offLogs()
      offSystem()
      offMacros()
    }
  }, [
    loadDashboardStats,
    loadMacros,
    loadRecentLogs,
    subscribeMacroStatus,
    subscribeRealtimeLogs,
    subscribeSystemStatus
  ])

  return (
    <section data-testid="dashboard-screen" className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={tx('dashboard.stats.totalAutomations')}
          value={String(stats?.totalAutomations ?? 0)}
        />
        <StatCard
          label={tx('dashboard.stats.timeSaved')}
          value={formatTimeSaved(stats?.timeSavedMinutes ?? 0)}
          accent="blue"
        />
        <StatCard
          label={tx('dashboard.stats.successRate')}
          value={formatRate(stats?.successRate ?? 0)}
        />
        <StatCard
          label={tx('dashboard.stats.activeNow')}
          value={String(stats?.activeNow ?? 0).padStart(2, '0')}
          accent="orange"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {macros.map((macro) => (
          <MacroCard
            key={macro.id}
            id={macro.id}
            name={macro.name}
            description={macro.description}
            shortcut={macro.shortcut}
            isActive={macro.isActive}
            status={macro.status}
            onToggle={(id, value) => {
              void setMacroActive(id, value)
            }}
            onRun={(id) => {
              void runMacroManually(id)
            }}
          />
        ))}

        <article className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-[var(--kb-border)] bg-[var(--kb-bg-surface-strong)]">
          <button
            type="button"
            className="flex flex-col items-center gap-4 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-overlay)] px-8 py-8 text-[var(--kb-text-muted)] transition hover:brightness-110"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--kb-border)] text-[var(--kb-text-main)]">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold tracking-[0.16em] uppercase">
              {tx('dashboard.createCustomBlock')}
            </span>
          </button>
        </article>
      </div>

      <RecentActivityLogs logs={logs} />
    </section>
  )
}

export default DashboardScreen
