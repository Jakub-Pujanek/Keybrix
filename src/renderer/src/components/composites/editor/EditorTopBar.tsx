import { Play } from 'lucide-react'
import Button from '../../primitives/Button'
import ShortcutRecorderInput from './ShortcutRecorderInput'
import { useI18n } from '../../../lib/useI18n'

type EditorTopBarProps = {
  macroTitle: string
  shortcut: string
  isRecording: boolean
  pressedPreview: string
  shortcutError: string | null
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
  shortcutError,
  onMacroTitleChange,
  onStartShortcutRecording,
  onCancelShortcutRecording,
  onClear,
  onTestRun,
  onSave
}: EditorTopBarProps): React.JSX.Element {
  const { tx } = useI18n()

  return (
    <div className="space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--kb-border) bg-(--kb-bg-panel) px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <input
            type="text"
            data-kb-text-input="1"
            value={macroTitle}
            maxLength={60}
            onKeyDown={(event) => {
              event.stopPropagation()
            }}
            onKeyUp={(event) => {
              event.stopPropagation()
            }}
            onChange={(event) => {
              onMacroTitleChange(event.target.value)
            }}
            className="min-w-[10ch] max-w-[min(56vw,34ch)] bg-transparent text-[clamp(1.1rem,2.8vw,2rem)] leading-tight font-semibold text-(--kb-text-main) outline-none"
            style={{ width: `${Math.max(10, Math.min(34, macroTitle.length + 1))}ch` }}
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

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-(--kb-text-muted) hover:text-(--kb-text-main) sm:text-sm"
          >
            {tx('editor.topBar.clear')}
          </button>
          <Button
            variant="ghost"
            onClick={onTestRun}
            className="h-8 rounded border border-(--kb-border) px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
          >
            <Play className="mr-2 h-4 w-4" />
            {tx('editor.topBar.testRun')}
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            className="h-8 rounded px-3 text-xs sm:h-9 sm:px-5 sm:text-sm"
          >
            {tx('editor.topBar.saveMacro')}
          </Button>
        </div>
      </header>

      {shortcutError ? (
        <p data-testid="editor-shortcut-error" className="px-1 text-xs text-red-300">
          {shortcutError}
        </p>
      ) : null}
    </div>
  )
}

export default EditorTopBar
