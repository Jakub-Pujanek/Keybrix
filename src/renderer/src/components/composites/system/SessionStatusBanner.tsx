import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, MonitorCog } from 'lucide-react'
import Button from '../../primitives/Button'
import { useSessionStore } from '../../../store/session.store'
import { useI18n } from '../../../lib/useI18n'

function SessionStatusBanner(): React.JSX.Element | null {
  const { tx } = useI18n()
  const sessionInfo = useSessionStore((state) => state.sessionInfo)
  const isChecking = useSessionStore((state) => state.isChecking)
  const showSuccessUntil = useSessionStore((state) => state.showSuccessUntil)
  const refreshSessionInfo = useSessionStore((state) => state.refreshSessionInfo)
  const openWaylandGuide = useSessionStore((state) => state.openWaylandGuide)
  const consumeSuccessAutohide = useSessionStore((state) => state.consumeSuccessAutohide)

  const showSuccess = typeof showSuccessUntil === 'number'

  useEffect(() => {
    if (!showSuccessUntil) return

    const delay = Math.max(0, showSuccessUntil - Date.now())
    const timeoutId = window.setTimeout(() => {
      consumeSuccessAutohide()
    }, delay)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [consumeSuccessAutohide, showSuccessUntil])

  if (!sessionInfo && !isChecking) {
    return null
  }

  const shouldRender =
    isChecking ||
    showSuccess ||
    sessionInfo?.sessionType === 'WAYLAND' ||
    sessionInfo?.sessionType === 'UNKNOWN'

  if (!shouldRender) {
    return null
  }

  const variant = isChecking
    ? 'CHECKING'
    : showSuccess
      ? 'SUCCESS'
      : sessionInfo?.sessionType === 'WAYLAND'
        ? 'BLOCKED'
        : 'UNKNOWN'

  const appearance =
    variant === 'SUCCESS'
      ? {
          wrapper:
            'border-emerald-400/40 bg-[linear-gradient(120deg,rgba(16,185,129,0.22),rgba(6,95,70,0.22))] text-emerald-50',
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-200" />,
          title: tx('wayland.banner.success.title'),
          body: tx('wayland.banner.success.body')
        }
      : variant === 'BLOCKED'
        ? {
            wrapper:
              'border-amber-400/40 bg-[linear-gradient(120deg,rgba(251,191,36,0.2),rgba(180,83,9,0.22))] text-amber-50',
            icon: <AlertTriangle className="h-5 w-5 text-amber-200" />,
            title: tx('wayland.banner.blocked.title'),
            body: tx('wayland.banner.blocked.body')
          }
        : variant === 'CHECKING'
          ? {
              wrapper:
                'border-sky-400/35 bg-[linear-gradient(120deg,rgba(14,165,233,0.2),rgba(3,105,161,0.22))] text-sky-50',
              icon: <LoaderCircle className="h-5 w-5 animate-spin text-sky-200" />,
              title: tx('wayland.banner.checking.title'),
              body: tx('wayland.banner.checking.body')
            }
          : {
              wrapper:
                'border-slate-400/35 bg-[linear-gradient(120deg,rgba(100,116,139,0.2),rgba(51,65,85,0.22))] text-slate-100',
              icon: <MonitorCog className="h-5 w-5 text-slate-200" />,
              title: tx('wayland.banner.unknown.title'),
              body: tx('wayland.banner.unknown.body')
            }

  return (
    <section className="pointer-events-none fixed right-4 bottom-4 left-4 z-1500 md:left-24">
      <article
        className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_20px_45px_-26px_rgba(0,0,0,0.8)] backdrop-blur-sm ${appearance.wrapper}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{appearance.icon}</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{appearance.title}</h3>
            <p className="mt-1 text-xs opacity-90">{appearance.body}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              className="h-8 bg-black/15 px-2 text-xs text-white hover:bg-black/25"
              disabled={isChecking}
              onClick={() => {
                void refreshSessionInfo()
              }}
            >
              {tx('wayland.banner.checkNow')}
            </Button>
            <Button
              variant="ghost"
              className="h-8 bg-black/15 px-2 text-xs text-white hover:bg-black/25"
              onClick={openWaylandGuide}
            >
              {tx('wayland.banner.openGuide')}
            </Button>
          </div>
        </div>
      </article>
    </section>
  )
}

export default SessionStatusBanner
