import type { ActivityLog } from '../../../../../shared/api'

type RecentActivityLogsProps = {
  logs: ActivityLog[]
}

const levelColorMap: Record<ActivityLog['level'], string> = {
  RUN: 'text-blue-400',
  TRIG: 'text-orange-400',
  INFO: 'text-slate-300',
  WARN: 'text-amber-300',
  ERR: 'text-red-400'
}

function RecentActivityLogs({ logs }: RecentActivityLogsProps): React.JSX.Element {
  return (
    <section
      data-testid="recent-activity-logs"
      className="rounded-xl border border-white/10 bg-gradient-to-b from-[#1a2233] to-[#101828]"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          Recent Activity Logs
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-red-300" />
          <span className="h-2 w-2 rounded-full bg-orange-300" />
          <span className="h-2 w-2 rounded-full bg-blue-300" />
        </div>
      </header>

      <div className="space-y-2 px-5 py-4">
        {logs.slice(0, 6).map((log) => (
          <p key={log.id} className="font-mono text-xs text-slate-300">
            <span className="text-slate-500">{log.timestamp}</span>{' '}
            <span className={`${levelColorMap[log.level]} font-semibold`}>{log.level}</span>{' '}
            {log.message}
          </p>
        ))}
      </div>
    </section>
  )
}

export default RecentActivityLogs
