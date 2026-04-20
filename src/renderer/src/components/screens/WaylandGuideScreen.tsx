import Button from '../primitives/Button'
import { useSessionStore } from '../../store/session.store'
import { useI18n } from '../../lib/useI18n'

function WaylandGuideScreen(): React.JSX.Element {
  const { tx } = useI18n()
  const refreshSessionInfo = useSessionStore((state) => state.refreshSessionInfo)
  const closeWaylandGuide = useSessionStore((state) => state.closeWaylandGuide)
  const isChecking = useSessionStore((state) => state.isChecking)

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 py-2" data-testid="wayland-guide-screen">
      <header className="rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) p-6">
        <h2 className="text-2xl font-semibold text-(--kb-text-main)">
          {tx('wayland.guide.title')}
        </h2>
        <p className="mt-2 text-sm text-(--kb-text-muted)">{tx('wayland.guide.subtitle')}</p>
      </header>

      <article className="rounded-xl border border-(--kb-border) bg-(--kb-bg-panel) p-6">
        <h3 className="text-sm font-semibold tracking-[0.1em] text-(--kb-text-muted) uppercase">
          {tx('wayland.guide.stepsTitle')}
        </h3>
        <ol className="mt-4 space-y-3 text-sm text-(--kb-text-main)">
          <li>{tx('wayland.guide.steps.step1')}</li>
          <li>{tx('wayland.guide.steps.step2')}</li>
          <li>{tx('wayland.guide.steps.step3')}</li>
          <li>{tx('wayland.guide.steps.step4')}</li>
        </ol>

        <p className="mt-5 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {tx('wayland.guide.disclaimer')}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={isChecking}
            onClick={() => {
              void refreshSessionInfo()
            }}
          >
            {isChecking ? tx('wayland.banner.checking.short') : tx('wayland.banner.checkNow')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              closeWaylandGuide()
            }}
          >
            {tx('wayland.guide.back')}
          </Button>
        </div>
      </article>
    </section>
  )
}

export default WaylandGuideScreen
