import { GripVertical } from 'lucide-react'
import type { EditorNode } from '../../../../../shared/api'
import ShortcutRecorderInput from './ShortcutRecorderInput'

type ActionBlockProps = {
  node: EditorNode
  isSelected: boolean
  isRecordingShortcut: boolean
  pressedPreview: string
  highlightTopNotch: boolean
  highlightBottomNotch: boolean
  onStartShortcutRecording: () => void
  onCancelShortcutRecording: () => void
  onUpdatePayload: (nextPayload: Record<string, unknown>) => void
}

const colorByType: Record<EditorNode['type'], string> = {
  START: 'from-[#5a49ff] to-[#4a52ff]',
  PRESS_KEY: 'from-[#2f6eff] to-[#3666d8]',
  WAIT: 'from-[#00a97b] to-[#0f9f70]',
  MOUSE_CLICK: 'from-[#f57a00] to-[#ef6f00]',
  TYPE_TEXT: 'from-[#2f6eff] to-[#3666d8]',
  REPEAT: 'from-[#00a97b] to-[#0f9f70]'
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
  const label = String(node.payload.label ?? node.type)
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
          className={`pointer-events-none absolute top-0 left-[30px] z-30 h-[11px] w-[74px] rounded-b-[6px] border-r border-b border-l -translate-y-[1px] ${highlightTopNotch ? 'border-[#ffd06b] bg-[#11224a]' : 'border-white/20 bg-[#070f21]'}`}
        />
      ) : null}
      <div
        className={`relative rounded border bg-gradient-to-r ${colorByType[node.type]} px-5 py-3 text-white shadow-[0_14px_30px_-20px_rgba(2,8,22,0.9)] ${isSelected ? 'border-[#ffd06b] ring-2 ring-[#ffd06b]/70' : 'border-white/10'}`}
      >
        <div
          className={`pointer-events-none absolute bottom-0 left-[30px] z-30 h-[12px] w-[74px] translate-y-[11px] rounded-b-[7px] border-r border-b border-l ${highlightBottomNotch ? 'border-[#ffd06b] bg-[#1f438d]' : 'border-white/20 bg-[#17336f]'}`}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 opacity-80" />
            <p className="text-[22px] font-semibold tracking-tight">{label}</p>
          </div>

          {node.type === 'START' ? (
            <ShortcutRecorderInput
              value={shortcut}
              isRecording={isRecordingShortcut}
              pressedPreview={pressedPreview}
              onStart={onStartShortcutRecording}
              onCancel={onCancelShortcutRecording}
            />
          ) : null}
        </div>

        {node.type === 'PRESS_KEY' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              Key
            </label>
            <input
              value={keyToPress}
              onChange={(event) => onUpdatePayload({ key: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-44 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="np. CTRL + C"
            />
          </div>
        ) : null}

        {node.type === 'TYPE_TEXT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              Text
            </label>
            <input
              value={textToType}
              onChange={(event) => onUpdatePayload({ text: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-full rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Wpisz tekst do wklepania"
            />
          </div>
        ) : null}

        {node.type === 'WAIT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              Wait ms
            </label>
            <input
              type="number"
              min={0}
              value={waitMs}
              onChange={(event) => onUpdatePayload({ durationMs: Number(event.target.value) || 0 })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-28 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
            />
          </div>
        ) : null}

        {node.type === 'MOUSE_CLICK' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              X
            </label>
            <input
              type="number"
              value={mouseX}
              onChange={(event) => onUpdatePayload({ x: Number(event.target.value) || 0 })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-20 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
            />
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              Y
            </label>
            <input
              type="number"
              value={mouseY}
              onChange={(event) => onUpdatePayload({ y: Number(event.target.value) || 0 })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-20 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
            />
            <select
              value={mouseButton}
              onChange={(event) => onUpdatePayload({ button: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
            >
              <option value="LEFT">LEFT</option>
              <option value="RIGHT">RIGHT</option>
              <option value="MIDDLE">MIDDLE</option>
            </select>
          </div>
        ) : null}

        {node.type === 'REPEAT' ? (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold tracking-[0.08em] text-white/80 uppercase">
              Count
            </label>
            <input
              type="number"
              min={1}
              value={repeatCount}
              onChange={(event) =>
                onUpdatePayload({ count: Math.max(1, Number(event.target.value) || 1) })
              }
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 w-24 rounded border border-white/20 bg-black/25 px-2 text-sm text-white outline-none focus:border-white/40"
            />
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default ActionBlock
