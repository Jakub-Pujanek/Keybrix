import { Play } from 'lucide-react'
import Button from '../../primitives/Button'
import ShortcutRecorderInput from './ShortcutRecorderInput'
import { useI18n } from '../../../lib/useI18n'

type EditorTopBarProps = {
  macroTitle: string
  shortcut: string
  isRecording: boolean
  pressedPreview: string
  onMacroTitleChange: (value: string) => void
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
  onMacroTitleChange,
  onStartShortcutRecording,
  onCancelShortcutRecording,
  onClear,
  onTestRun,
  onSave
}: EditorTopBarProps): React.JSX.Element {
  const { tx } = useI18n()

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--kb-border)] bg-[var(--kb-bg-panel)] px-5 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <input
          value={macroTitle}
          maxLength={60}
          onChange={(event) => {
            onMacroTitleChange(event.target.value)
          }}
          className="min-w-[10ch] max-w-[50vw] bg-transparent text-[32px] font-semibold text-[var(--kb-text-main)] outline-none"
          style={{ width: `${Math.max(10, macroTitle.length + 1)}ch` }}
          aria-label="Macro title"
        />
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
          className="text-sm font-semibold text-[var(--kb-text-muted)] hover:text-[var(--kb-text-main)]"
        >
          {tx('editor.topBar.clear')}
        </button>
        <Button
          variant="ghost"
          onClick={onTestRun}
          className="h-10 rounded border border-[var(--kb-border)] px-4 text-sm"
        >
          <Play className="mr-2 h-4 w-4" />
          {tx('editor.topBar.testRun')}
        </Button>
        <Button variant="primary" onClick={onSave} className="h-10 rounded px-5 text-sm">
          {tx('editor.topBar.saveMacro')}
        </Button>
      </div>
    </header>
  )
}

export default EditorTopBar
