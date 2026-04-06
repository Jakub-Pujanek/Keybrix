import { memo } from 'react'
import { GripVertical } from 'lucide-react'
import type { EditorNode } from '../../../../../shared/api'
import ShortcutRecorderInput from './ShortcutRecorderInput'
import { useI18n } from '../../../lib/useI18n'

type ActionBlockProps = {
  node: EditorNode
  isSelected: boolean
  isRecordingShortcut: boolean
  pressedPreview: string
  highlightTopNotch: boolean
  highlightBottomNotch: boolean
  onStartShortcutRecording: (nodeId: string, nodeType: EditorNode['type']) => void
  onCancelShortcutRecording: () => void
  onUpdatePayload: (nodeId: string, nextPayload: Record<string, unknown>) => void
}

const colorByType: Record<EditorNode['type'], string> = {
  START: 'from-[var(--kb-node-start-from)] to-[var(--kb-node-start-to)]',
  PRESS_KEY: 'from-[var(--kb-node-press-from)] to-[var(--kb-node-press-to)]',
  WAIT: 'from-[var(--kb-node-wait-from)] to-[var(--kb-node-wait-to)]',
  MOUSE_CLICK: 'from-[var(--kb-node-mouse-from)] to-[var(--kb-node-mouse-to)]',
  TYPE_TEXT: 'from-[var(--kb-node-press-from)] to-[var(--kb-node-press-to)]',
  REPEAT: 'from-[var(--kb-node-wait-from)] to-[var(--kb-node-wait-to)]',
  INFINITE_LOOP: 'from-[var(--kb-node-wait-from)] to-[var(--kb-node-wait-to)]'
}

const numeric = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function ActionBlock({
  node,
  isSelected,
  isRecordingShortcut,
  pressedPreview,
  highlightTopNotch,
  highlightBottomNotch,
  onStartShortcutRecording,
  onCancelShortcutRecording,
  onUpdatePayload
}: ActionBlockProps): React.JSX.Element {
  const { tx } = useI18n()
  const defaultLabelByType: Record<EditorNode['type'], string> = {
    START: tx('editor.library.blocks.start'),
    PRESS_KEY: tx('editor.library.blocks.pressKey'),
    WAIT: tx('editor.library.blocks.wait'),
    MOUSE_CLICK: tx('editor.library.blocks.mouseClick'),
    TYPE_TEXT: tx('editor.library.blocks.typeText'),
    REPEAT: tx('editor.library.blocks.repeat'),
    INFINITE_LOOP: tx('editor.library.blocks.infiniteLoop')
  }

  const label = String(node.payload.label ?? defaultLabelByType[node.type])
  const shortcut = String(node.payload.shortcut ?? '')
  const keyToPress = String(node.payload.key ?? 'A')
  const textToType = String(node.payload.text ?? '')
  const waitMs = numeric(node.payload.durationMs, 300)
  const mouseX = numeric(node.payload.x, 500)
  const mouseY = numeric(node.payload.y, 300)
  const mouseButton = String(node.payload.button ?? 'LEFT')
  const repeatCount = numeric(node.payload.count, 2)
  const showTopNotch = node.type !== 'START'

  return (
    <article className="relative w-[430px]">
      {showTopNotch ? (
        <div
          className={`pointer-events-none absolute top-0 left-[30px] z-30 h-[11px] w-[74px] rounded-b-[6px] border-r border-b border-l -translate-y-[1px] ${highlightTopNotch ? 'border-[var(--kb-node-notch-highlight-border)] bg-[var(--kb-node-notch-highlight-top-bg)]' : 'border-[var(--kb-node-notch-default-border)] bg-[var(--kb-node-notch-default-top-bg)]'}`}
        />
      ) : null}
      <div
        className={`relative rounded border bg-gradient-to-r ${colorByType[node.type]} px-5 py-3 text-white shadow-[0_14px_30px_-20px_rgba(2,8,22,0.9)] ${isSelected ? 'border-[var(--kb-node-selected-border)] ring-2 ring-[var(--kb-node-selected-border)]/70' : 'border-[var(--kb-border)]'}`}
      >
        <div
          className={`pointer-events-none absolute bottom-0 left-[30px] z-30 h-[12px] w-[74px] translate-y-[11px] rounded-b-[7px] border-r border-b border-l ${highlightBottomNotch ? 'border-[var(--kb-node-notch-highlight-border)] bg-[var(--kb-node-notch-highlight-bottom-bg)]' : 'border-[var(--kb-node-notch-default-border)] bg-[var(--kb-node-notch-default-bottom-bg)]'}`}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 opacity-80" />
            <p className="text-[22px] font-semibold tracking-tight">{label}</p>
          </div>

          {node.type === 'START' || node.type === 'PRESS_KEY' ? (
            <ShortcutRecorderInput
              value={node.type === 'START' ? shortcut : keyToPress}
              isRecording={isRecordingShortcut}
              pressedPreview={pressedPreview}
              onStart={() => onStartShortcutRecording(node.id, node.type)}
              onCancel={onCancelShortcutRecording}
            />
          ) : null}
        </div>

        {node.type === 'PRESS_KEY' && !isRecordingShortcut ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.key')}
            </label>
            <input
              value={keyToPress}
              onChange={(event) => onUpdatePayload(node.id, { key: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-44 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
              placeholder={tx('editor.placeholder.keyCombo')}
            />
          </div>
        ) : null}

        {node.type === 'TYPE_TEXT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.text')}
            </label>
            <input
              value={textToType}
              onChange={(event) => onUpdatePayload(node.id, { text: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-full rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
              placeholder={tx('editor.placeholder.typeText')}
            />
          </div>
        ) : null}

        {node.type === 'WAIT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.waitMs')}
            </label>
            <input
              type="number"
              min={0}
              value={waitMs}
              onChange={(event) =>
                onUpdatePayload(node.id, { durationMs: Number(event.target.value) || 0 })
              }
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-28 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
            />
          </div>
        ) : null}

        {node.type === 'MOUSE_CLICK' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.x')}
            </label>
            <input
              type="number"
              value={mouseX}
              onChange={(event) => onUpdatePayload(node.id, { x: Number(event.target.value) || 0 })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-20 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
            />
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.y')}
            </label>
            <input
              type="number"
              value={mouseY}
              onChange={(event) => onUpdatePayload(node.id, { y: Number(event.target.value) || 0 })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-20 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
            />
            <select
              value={mouseButton}
              onChange={(event) => onUpdatePayload(node.id, { button: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
            >
              <option value="LEFT">{tx('editor.mouseButton.LEFT')}</option>
              <option value="RIGHT">{tx('editor.mouseButton.RIGHT')}</option>
              <option value="MIDDLE">{tx('editor.mouseButton.MIDDLE')}</option>
            </select>
          </div>
        ) : null}

        {node.type === 'REPEAT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              {tx('editor.field.count')}
            </label>
            <input
              type="number"
              min={1}
              value={repeatCount}
              onChange={(event) =>
                onUpdatePayload(node.id, { count: Math.max(1, Number(event.target.value) || 1) })
              }
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-24 rounded border border-white/20 bg-[var(--kb-node-input-bg)] px-2 text-sm text-white outline-none focus:border-white/40"
            />
          </div>
        ) : null}

        {node.type === 'INFINITE_LOOP' ? (
          <div className="mt-3 text-xs font-semibold tracking-[0.08em] text-white/85 uppercase">
            {tx('editor.infiniteLoop.runsForever')}
          </div>
        ) : null}
      </div>
    </article>
  )
}

const areEqual = (prev: ActionBlockProps, next: ActionBlockProps): boolean => {
  return (
    prev.node === next.node &&
    prev.isSelected === next.isSelected &&
    prev.isRecordingShortcut === next.isRecordingShortcut &&
    prev.pressedPreview === next.pressedPreview &&
    prev.highlightTopNotch === next.highlightTopNotch &&
    prev.highlightBottomNotch === next.highlightBottomNotch
  )
}

export default memo(ActionBlock, areEqual)
