import Button from '../../primitives/Button'
import { useI18n } from '../../../lib/useI18n'

type ShortcutRecorderInputProps = {
  value: string
  isRecording: boolean
  pressedPreview: string
  onStart: () => void
  onCancel: () => void
}

function ShortcutRecorderInput({
  value,
  isRecording,
  pressedPreview,
  onStart,
  onCancel
}: ShortcutRecorderInputProps): React.JSX.Element {
  const { tx } = useI18n()

  if (isRecording) {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-[rgb(var(--kb-accent-rgb))] px-3 py-2 text-xs font-bold tracking-[0.14em] text-white uppercase">
        <button type="button" onClick={onCancel} className="opacity-90 hover:opacity-100">
          {tx('editor.shortcut.rec')}
        </button>
        <span>{pressedPreview || tx('editor.shortcut.pressKeys')}</span>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onStart}
      className="h-8 rounded bg-[rgb(var(--kb-accent-rgb))] px-3 text-xs font-bold tracking-[0.14em] text-white uppercase hover:brightness-110"
    >
      {value}
    </Button>
  )
}

export default ShortcutRecorderInput
