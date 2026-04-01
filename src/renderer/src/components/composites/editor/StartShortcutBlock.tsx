import ShortcutRecorderInput from './ShortcutRecorderInput'

type StartShortcutBlockProps = {
  shortcut: string
  isRecording: boolean
  pressedPreview: string
  onStartRecording: () => void
  onCancelRecording: () => void
}

function StartShortcutBlock({
  shortcut,
  isRecording,
  pressedPreview,
  onStartRecording,
  onCancelRecording
}: StartShortcutBlockProps): React.JSX.Element {
  return (
    <div className="rounded border border-white/15 bg-[#222a42] p-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
        Start Shortcut
      </p>
      <div className="mt-2">
        <ShortcutRecorderInput
          value={shortcut}
          isRecording={isRecording}
          pressedPreview={pressedPreview}
          onStart={onStartRecording}
          onCancel={onCancelRecording}
        />
      </div>
    </div>
  )
}

export default StartShortcutBlock
