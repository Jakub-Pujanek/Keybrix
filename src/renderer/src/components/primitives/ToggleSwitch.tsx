type ToggleSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-full transition-colors ${checked ? 'bg-[#2f79ff]' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  )
}

export default ToggleSwitch
