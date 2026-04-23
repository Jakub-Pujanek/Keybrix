import { useEffect } from 'react'
import { Download, X } from 'lucide-react'
import Button from '../../primitives/Button'
import { useI18n } from '../../../lib/useI18n'
import { useUpdaterStore } from '../../../store/updater.store'

function UpdateReadyToast(): React.JSX.Element | null {
  const { tx } = useI18n()
  const updaterState = useUpdaterStore((state) => state.updaterState)
  const isToastVisible = useUpdaterStore((state) => state.isToastVisible)
  const isInstalling = useUpdaterStore((state) => state.isInstalling)
  const dismissToast = useUpdaterStore((state) => state.dismissToast)
  const installNow = useUpdaterStore((state) => state.installNow)
  const subscribeUpdater = useUpdaterStore((state) => state.subscribeUpdater)

  useEffect(() => {
    const off = subscribeUpdater()
    return () => {
      off()
    }
  }, [subscribeUpdater])

  if (!isToastVisible || updaterState.status !== 'DOWNLOADED') {
    return null
  }

  return (
    <section className="pointer-events-none fixed right-4 bottom-4 left-4 z-1600 md:left-auto md:w-107.5">
      <article className="pointer-events-auto rounded-xl border border-sky-400/35 bg-[linear-gradient(120deg,rgba(56,189,248,0.25),rgba(3,105,161,0.26))] px-4 py-3 text-sky-50 shadow-[0_20px_45px_-26px_rgba(0,0,0,0.8)] backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-sky-300/20 p-1">
            <Download className="h-4 w-4 text-sky-100" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">
              {tx('notifications.updateReady.title', {
                version: updaterState.version ?? 'unknown'
              })}
            </h3>
            <p className="mt-1 text-xs opacity-90">{tx('notifications.updateReady.body')}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-8 bg-black/15 px-2 text-xs text-white hover:bg-black/25"
                disabled={isInstalling}
                onClick={() => {
                  void installNow()
                }}
              >
                {tx('notifications.updateReady.installNow')}
              </Button>
              <Button
                variant="ghost"
                className="h-8 bg-black/15 px-2 text-xs text-white hover:bg-black/25"
                disabled={isInstalling}
                onClick={dismissToast}
              >
                {tx('notifications.updateReady.later')}
              </Button>
            </div>
          </div>
          <Button
            variant="icon"
            aria-label={tx('notifications.updateReady.close')}
            className="h-7 w-7 rounded-full text-sky-100 hover:bg-black/20"
            disabled={isInstalling}
            onClick={dismissToast}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </article>
    </section>
  )
}

export default UpdateReadyToast
