import type { ActivityLog } from '../../../../../shared/api'
import Button from '../../primitives/Button'
import OverlayShell from '../../primitives/OverlayShell'
import { useI18n } from '../../../lib/useI18n'

type TestRunStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'BLOCKED' | 'TIMEOUT' | 'ERROR'

type TestRunModalProps = {
  isOpen: boolean
  isRunning: boolean
  status: TestRunStatus
  sessionId: string | null
  reasonCode: string | null
  sandboxText: string
  logs: ActivityLog[]
  error: string | null
  onSandboxTextChange: (value: string) => void
  onRun: () => Promise<void>
  onStop: () => Promise<void>
  onClose: () => void
}

const levelClass: Record<ActivityLog['level'], string> = {
  RUN: 'text-blue-400',
  TRIG: 'text-orange-400',
  INFO: 'text-slate-300',
  WARN: 'text-amber-300',
  ERR: 'text-red-400'
}

const statusClass: Record<TestRunStatus, string> = {
  IDLE: 'text-slate-300',
  RUNNING: 'text-blue-300',
  SUCCESS: 'text-emerald-300',
  BLOCKED: 'text-amber-300',
  TIMEOUT: 'text-orange-300',
  ERROR: 'text-red-300'
}

function TestRunModal({
  isOpen,
  isRunning,
  status,
  sessionId,
  reasonCode,
  sandboxText,
  logs,
  error,
  onSandboxTextChange,
  onRun,
  onStop,
  onClose
}: TestRunModalProps): React.JSX.Element | null {
  const { tx } = useI18n()

  const statusLabel: Record<TestRunStatus, string> = {
    IDLE: tx('editor.testRun.status.IDLE'),
    RUNNING: tx('editor.testRun.status.RUNNING'),
    SUCCESS: tx('editor.testRun.status.SUCCESS'),
    BLOCKED: tx('editor.testRun.status.BLOCKED'),
    TIMEOUT: tx('editor.testRun.status.TIMEOUT'),
    ERROR: tx('editor.testRun.status.ERROR')
  }

  return (
    <OverlayShell
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isRunning}
      zIndexClassName="z-[2200]"
      panelClassName="grid h-full max-h-[min(88vh,760px)] w-full max-w-6xl min-w-0 gap-4 overflow-hidden rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) p-5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)] lg:h-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
      panelTestId="test-run-modal"
    >
      <section className="min-w-0">
        <h3 className="text-xl font-semibold text-(--kb-text-main)">
          {tx('editor.testRun.title')}
        </h3>
        <p className="mt-1 text-sm text-(--kb-text-muted)">{tx('editor.testRun.description')}</p>

        <textarea
          autoFocus
          value={sandboxText}
          onChange={(event) => {
            onSandboxTextChange(event.target.value)
          }}
          placeholder={tx('editor.testRun.sandboxPlaceholder')}
          className="mt-4 h-56 w-full min-w-0 resize-none rounded border border-(--kb-border) bg-(--kb-bg-overlay) p-3 text-sm text-(--kb-text-main) outline-none focus:border-[rgb(var(--kb-accent-rgb))]"
        />

        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRunning}>
            {tx('editor.testRun.actions.close')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (isRunning) {
                void onStop()
                return
              }

              void onRun()
            }}
          >
            {isRunning ? tx('editor.testRun.actions.stop') : tx('editor.testRun.actions.run')}
          </Button>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col rounded border border-(--kb-border) bg-(--kb-bg-panel) p-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold tracking-[0.08em] text-(--kb-text-muted) uppercase">
            {tx('editor.testRun.logsTitle')}
          </h4>
          <span className={`text-xs font-semibold ${statusClass[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        {sessionId ? (
          <p className="mt-1 break-all font-mono text-[11px] text-(--kb-text-muted)">{sessionId}</p>
        ) : null}
        {reasonCode ? (
          <p className="mt-1 break-all font-mono text-[11px] text-(--kb-text-muted)">
            {tx('editor.testRun.reasonCode', { reasonCode })}
          </p>
        ) : null}
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-(--kb-text-muted)">{tx('editor.testRun.emptyLogs')}</p>
          ) : (
            logs.map((log) => (
              <p key={log.id} className="wrap-break-word font-mono text-xs text-(--kb-text-main)">
                <span className="text-(--kb-text-muted)">{log.timestamp}</span>{' '}
                <span className={levelClass[log.level]}>{log.level}</span> {log.message}
              </p>
            ))
          )}
        </div>
      </section>
    </OverlayShell>
  )
}

export default TestRunModal
