import { Play } from 'lucide-react'
import Button from '../../primitives/Button'
import ShortcutRecorderInput from './ShortcutRecorderInput'

type EditorTopBarProps = {
  macroTitle: string
  shortcut: string
  isRecording: boolean
  pressedPreview: string
  onStartShortcutRecording: () => void
  onCancelShortcutRecording: () => void
  onClear: () => void
  onTestRun: () => void
  onSave: () => void
}

function EditorTopBar({
  macroTitle,
  shortcut,
  isRecording,
  pressedPreview,
  onStartShortcutRecording,
  onCancelShortcutRecording,
  onClear,
  onTestRun,
  onSave
}: EditorTopBarProps): React.JSX.Element {
  return (
    <header className="mb-4 flex items-center justify-between rounded border border-white/10 bg-[#0c1426]/80 px-5 py-3">
      <div className="flex items-center gap-4">
        <h2 className="text-[32px] font-semibold text-white">{macroTitle}</h2>
        <ShortcutRecorderInput
          value={shortcut}
          isRecording={isRecording}
          pressedPreview={pressedPreview}
          onStart={onStartShortcutRecording}
          onCancel={onCancelShortcutRecording}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-semibold text-slate-300 hover:text-white"
        >
          Clear
        </button>
        <Button
          variant="ghost"
          onClick={onTestRun}
          className="h-10 rounded border border-white/10 px-4 text-sm text-slate-200"
        >
          <Play className="mr-2 h-4 w-4" />
          Test Run
        </Button>
        <Button variant="primary" onClick={onSave} className="h-10 rounded px-5 text-sm">
          Save Macro
        </Button>
      </div>
    </header>
  )
}

export default EditorTopBar
