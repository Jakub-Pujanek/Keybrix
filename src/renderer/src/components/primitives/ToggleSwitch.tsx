type ToggleSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  accent?: 'blue' | 'orange'
}

function ToggleSwitch({
  checked,
  onChange,
  accent = 'blue'
}: ToggleSwitchProps): React.JSX.Element {
  const activeClass =
    accent === 'orange' ? 'bg-(--kb-accent-orange)' : 'bg-[rgb(var(--kb-accent-rgb))]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-full transition-colors ${checked ? activeClass : 'bg-white/15'}`}
    >
      <span
        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}
      />
    </button>
  )
}

export default ToggleSwitch
