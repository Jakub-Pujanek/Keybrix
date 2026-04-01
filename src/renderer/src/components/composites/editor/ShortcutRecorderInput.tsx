import Button from '../../primitives/Button'

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
  if (isRecording) {
    return (
      <div className="inline-flex items-center gap-2 rounded bg-[#ff821f] px-3 py-2 text-xs font-bold tracking-[0.14em] text-white uppercase">
        <button type="button" onClick={onCancel} className="opacity-90 hover:opacity-100">
          REC
        </button>
        <span>{pressedPreview || 'PRESS KEYS'}</span>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onStart}
      className="h-8 rounded bg-[#ff821f] px-3 text-xs font-bold tracking-[0.14em] text-white uppercase hover:bg-[#ff942f]"
    >
      {value}
    </Button>
  )
}

export default ShortcutRecorderInput
