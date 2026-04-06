type StatCardProps = {
  label: string
  value: string
  accent?: 'blue' | 'orange' | 'white'
}

const accentMap = {
  blue: 'text-[rgb(var(--kb-accent-rgb))]',
  orange: 'text-[var(--kb-accent-orange)]',
  white: 'text-[var(--kb-text-main)]'
}

function StatCard({ label, value, accent = 'white' }: StatCardProps): React.JSX.Element {
  return (
    <article
      data-testid="stat-card"
      className="min-h-24 rounded-lg border border-transparent bg-transparent"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--kb-text-muted)] uppercase">
        {label}
      </p>
      <p className={`mt-2 text-5xl font-bold leading-none ${accentMap[accent]}`}>{value}</p>
    </article>
  )
}

export default StatCard
