import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import RecentActivityLogs from '../composites/activity/RecentActivityLogs'
import MacroCard from '../composites/macro/MacroCard'
import StatCard from '../composites/StatCard'
import ConfirmModal from '../composites/ui/ConfirmModal'
import {
  useActivityStore,
  useAppStore,
  useEditorStore,
  useMacroStore,
  useUiStore
} from '../../store'
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
  const setActiveScreen = useAppStore((state) => state.setActiveScreen)

  const macros = useMacroStore((state) => state.macros)
  const isMacrosLoading = useMacroStore((state) => state.isLoading)
  const macrosLoadError = useMacroStore((state) => state.loadError)
  const loadMacros = useMacroStore((state) => state.loadMacros)
  const deleteMacro = useMacroStore((state) => state.deleteMacro)
  const setMacroActive = useMacroStore((state) => state.setMacroActive)
  const runMacroManually = useMacroStore((state) => state.runMacroManually)
  const stopMacroManually = useMacroStore((state) => state.stopMacroManually)
  const subscribeMacroStatus = useMacroStore((state) => state.subscribeMacroStatus)

  const loadEditorMacro = useEditorStore((state) => state.loadEditorMacro)
  const openCreateMacroModal = useUiStore((state) => state.openCreateMacroModal)
  const deleteMacroConfirmTarget = useUiStore((state) => state.deleteMacroConfirmTarget)
  const openDeleteMacroConfirm = useUiStore((state) => state.openDeleteMacroConfirm)
  const closeDeleteMacroConfirm = useUiStore((state) => state.closeDeleteMacroConfirm)

  const [isDeleteMacroConfirming, setIsDeleteMacroConfirming] = useState(false)

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

  useEffect(() => {
    if (!deleteMacroConfirmTarget) {
      return
    }

    const targetStillExists = macros.some((macro) => macro.id === deleteMacroConfirmTarget.id)
    if (!targetStillExists) {
      closeDeleteMacroConfirm()
    }
  }, [closeDeleteMacroConfirm, deleteMacroConfirmTarget, macros])

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
        {isMacrosLoading ? (
          <article className="grid min-h-55 place-items-center rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) px-6 py-8 text-center text-(--kb-text-muted)">
            <p className="text-sm font-medium">Loading macros...</p>
          </article>
        ) : null}

        {!isMacrosLoading && macrosLoadError ? (
          <article className="rounded-xl border border-red-400/40 bg-red-500/10 px-5 py-5 text-sm text-red-200">
            <p className="font-semibold">Could not load macros</p>
            <p className="mt-1 opacity-90">{macrosLoadError}</p>
            <button
              type="button"
              className="mt-4 rounded-md border border-red-300/50 bg-red-500/20 px-3 py-1.5 text-xs font-semibold tracking-[0.08em] uppercase transition hover:bg-red-500/30"
              onClick={() => {
                void loadMacros()
              }}
            >
              Retry
            </button>
          </article>
        ) : null}

        {!isMacrosLoading && !macrosLoadError && macros.length === 0 ? (
          <article className="rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) px-5 py-5 text-(--kb-text-muted)">
            <p className="text-sm font-semibold tracking-[0.08em] uppercase">No macros yet</p>
            <p className="mt-2 text-sm/6">
              Macro list is empty. Use the create tile to add one or refresh the screen.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-(--kb-border) bg-(--kb-bg-overlay) px-3 py-1.5 text-xs font-semibold tracking-[0.08em] uppercase text-(--kb-text-main) transition hover:brightness-110"
              onClick={() => {
                void loadMacros()
              }}
            >
              Refresh list
            </button>
          </article>
        ) : null}

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
              void (async () => {
                await setMacroActive(id, value)
                await loadDashboardStats()
              })()
            }}
            onRun={(id) => {
              void (async () => {
                await runMacroManually(id)
                await loadDashboardStats()
              })()
            }}
            onStop={(id) => {
              void (async () => {
                await stopMacroManually(id)
                await loadDashboardStats()
              })()
            }}
            onEdit={(id) => {
              void (async () => {
                await loadEditorMacro(id)
                setActiveScreen('editor')
              })()
            }}
            onDelete={(id) => {
              const targetMacro = macros.find((macro) => macro.id === id)
              if (!targetMacro) {
                return
              }

              openDeleteMacroConfirm({
                id: targetMacro.id,
                name: targetMacro.name
              })
            }}
          />
        ))}

        <article className="grid min-h-70 place-items-center rounded-xl border border-dashed border-(--kb-border) bg-(--kb-bg-surface-strong)">
          <button
            type="button"
            onClick={openCreateMacroModal}
            className="flex flex-col items-center gap-4 rounded-xl border border-(--kb-border) bg-(--kb-bg-overlay) px-8 py-8 text-(--kb-text-muted) transition hover:brightness-110"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-(--kb-border) text-(--kb-text-main)">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold tracking-[0.16em] uppercase">
              {tx('dashboard.createCustomBlock')}
            </span>
          </button>
        </article>
      </div>

      <RecentActivityLogs logs={logs} />

      <ConfirmModal
        isOpen={Boolean(deleteMacroConfirmTarget)}
        title={tx('dashboard.deleteConfirm.title')}
        description={tx('dashboard.deleteConfirm.body', {
          macroName: deleteMacroConfirmTarget?.name ?? ''
        })}
        cancelLabel={tx('dashboard.deleteConfirm.cancel')}
        confirmLabel={
          isDeleteMacroConfirming
            ? tx('dashboard.deleteConfirm.confirming')
            : tx('dashboard.deleteConfirm.confirm')
        }
        isConfirming={isDeleteMacroConfirming}
        onCancel={() => {
          if (isDeleteMacroConfirming) {
            return
          }

          closeDeleteMacroConfirm()
        }}
        onConfirm={() => {
          if (!deleteMacroConfirmTarget || isDeleteMacroConfirming) {
            return
          }

          setIsDeleteMacroConfirming(true)
          void (async () => {
            try {
              const success = await deleteMacro(deleteMacroConfirmTarget.id)
              if (!success) {
                return
              }

              await loadMacros()
              await loadDashboardStats()
              closeDeleteMacroConfirm()
            } finally {
              setIsDeleteMacroConfirming(false)
            }
          })()
        }}
      />
    </section>
  )
}

export default DashboardScreen
