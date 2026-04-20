import ShortcutRecorderInput from './ShortcutRecorderInput'
import { useI18n } from '../../../lib/useI18n'

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
  const { tx } = useI18n()

  return (
    <div className="rounded border border-(--kb-border) bg-(--kb-bg-surface) p-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-(--kb-text-muted) uppercase">
        {tx('editor.shortcut.startShortcut')}
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
