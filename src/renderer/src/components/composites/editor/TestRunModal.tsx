import type { ActivityLog } from '../../../../../shared/api'
import Button from '../../primitives/Button'

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

const statusLabel: Record<TestRunStatus, string> = {
  IDLE: 'Oczekuje',
  RUNNING: 'Uruchamianie',
  SUCCESS: 'Sukces',
  BLOCKED: 'Zablokowane',
  TIMEOUT: 'Timeout',
  ERROR: 'Blad'
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
  onClose
}: TestRunModalProps): React.JSX.Element | null {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/55 px-4"
      onClick={() => {
        if (!isRunning) onClose()
      }}
    >
      <article
        className="grid w-full max-w-6xl gap-4 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-surface)] p-5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)] lg:grid-cols-[1.2fr_1fr]"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <section>
          <h3 className="text-xl font-semibold text-[var(--kb-text-main)]">Test makra na zywo</h3>
          <p className="mt-1 text-sm text-[var(--kb-text-muted)]">
            Kliknij w pole i uruchom test. Jesli makro wpisuje tekst, zobaczysz rezultat tutaj.
          </p>

          <textarea
            autoFocus
            value={sandboxText}
            onChange={(event) => {
              onSandboxTextChange(event.target.value)
            }}
            placeholder="Pole testowe: tutaj zobaczysz efekt klikow/pisania"
            className="mt-4 h-56 w-full resize-none rounded border border-[var(--kb-border)] bg-[var(--kb-bg-overlay)] p-3 text-sm text-[var(--kb-text-main)] outline-none focus:border-[rgb(var(--kb-accent-rgb))]"
          />

          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isRunning}>
              Zamknij
            </Button>
            <Button
              variant="primary"
              disabled={isRunning}
              onClick={() => {
                void onRun()
              }}
            >
              {isRunning ? 'Uruchamianie...' : 'Uruchom test teraz'}
            </Button>
          </div>
        </section>

        <section className="rounded border border-[var(--kb-border)] bg-[var(--kb-bg-panel)] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold tracking-[0.08em] text-[var(--kb-text-muted)] uppercase">
              Logi wykonania
            </h4>
            <span className={`text-xs font-semibold ${statusClass[status]}`}>
              {statusLabel[status]}
            </span>
          </div>
          {sessionId ? (
            <p className="mt-1 font-mono text-[11px] text-[var(--kb-text-muted)]">{sessionId}</p>
          ) : null}
          {reasonCode ? (
            <p className="mt-1 font-mono text-[11px] text-[var(--kb-text-muted)]">
              reason: {reasonCode}
            </p>
          ) : null}
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-[var(--kb-text-muted)]">Brak logow. Uruchom test makra.</p>
            ) : (
              logs.map((log) => (
                <p key={log.id} className="font-mono text-xs text-[var(--kb-text-main)]">
                  <span className="text-[var(--kb-text-muted)]">{log.timestamp}</span>{' '}
                  <span className={levelClass[log.level]}>{log.level}</span> {log.message}
                </p>
              ))
            )}
          </div>
        </section>
      </article>
    </div>
  )
}

export default TestRunModal
