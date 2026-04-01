import {
  Filter,
  Keyboard,
  MousePointerClick,
  MoveRight,
  Repeat2,
  TextCursorInput
} from 'lucide-react'
import { useRef } from 'react'
import type { EditorBlockType } from '../../../../../shared/api'

type BlocksLibraryPanelProps = {
  onAddBlock: (type: EditorBlockType) => void
}

type LibraryItem = {
  label: string
  type: EditorBlockType
  icon: React.ComponentType<{ className?: string }>
  group: 'TRIGGERS' | 'INPUT / KEYS' | 'MOUSE ACTIONS' | 'LOGIC & FLOW'
}

const items: LibraryItem[] = [
  { label: 'Start Block', type: 'START', icon: MoveRight, group: 'TRIGGERS' },
  { label: 'Press Key', type: 'PRESS_KEY', icon: Keyboard, group: 'INPUT / KEYS' },
  { label: 'Type Text', type: 'TYPE_TEXT', icon: TextCursorInput, group: 'INPUT / KEYS' },
  { label: 'Mouse Click', type: 'MOUSE_CLICK', icon: MousePointerClick, group: 'MOUSE ACTIONS' },
  { label: 'Wait (ms)', type: 'WAIT', icon: Filter, group: 'LOGIC & FLOW' },
  { label: 'Repeat Loop', type: 'REPEAT', icon: Repeat2, group: 'LOGIC & FLOW' },
  { label: 'Infinite Loop', type: 'INFINITE_LOOP', icon: Repeat2, group: 'LOGIC & FLOW' }
]

const groupOrder: LibraryItem['group'][] = [
  'TRIGGERS',
  'INPUT / KEYS',
  'MOUSE ACTIONS',
  'LOGIC & FLOW'
]

const groupAccentClass: Record<LibraryItem['group'], string> = {
  TRIGGERS: 'text-[#506cff]',
  'INPUT / KEYS': 'text-[#8ea5ff]',
  'MOUSE ACTIONS': 'text-[#f57a00]',
  'LOGIC & FLOW': 'text-[#00b58b]'
}

const itemClassByGroup: Record<LibraryItem['group'], string> = {
  TRIGGERS:
    'border-[#3152c5]/40 bg-[#1d2539] hover:border-[#4a6fff] hover:bg-[#202c46] text-slate-100',
  'INPUT / KEYS':
    'border-[#3c57ba]/40 bg-[#1d2539] hover:border-[#5f7fff] hover:bg-[#1f2c4b] text-slate-100',
  'MOUSE ACTIONS':
    'border-[#c46612]/45 bg-[#32241f] hover:border-[#ef8d32] hover:bg-[#412b22] text-[#f7d7bd]',
  'LOGIC & FLOW':
    'border-[#108f75]/45 bg-[#182936] hover:border-[#11b798] hover:bg-[#1b3040] text-[#d0f5eb]'
}

const iconClassByGroup: Record<LibraryItem['group'], string> = {
  TRIGGERS: 'text-[#9bb4ff]',
  'INPUT / KEYS': 'text-[#b8c7ff]',
  'MOUSE ACTIONS': 'text-[#ff9a3f]',
  'LOGIC & FLOW': 'text-[#11c7a3]'
}

function BlocksLibraryPanel({ onAddBlock }: BlocksLibraryPanelProps): React.JSX.Element {
  const suppressClickRef = useRef(false)

  return (
    <aside className="w-[245px] rounded border border-white/10 bg-[#141d31]/95 p-4">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
          Blocks Library
        </p>
        <Filter className="h-3 w-3 text-slate-500" />
      </div>

      <div className="space-y-6">
        {groupOrder.map((group) => (
          <section key={group}>
            <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-[#506cff] uppercase">
              <span className={groupAccentClass[group]}>{group}</span>
            </h3>
            <div className="space-y-2">
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={`${group}-${item.label}`}
                      type="button"
                      draggable
                      onClick={() => {
                        if (suppressClickRef.current) return
                        onAddBlock(item.type)
                      }}
                      onDragStart={(event) => {
                        suppressClickRef.current = true
                        event.dataTransfer.setData('application/x-keybrix-block-type', item.type)
                        event.dataTransfer.setData('text/plain', item.type)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      onDragEnd={() => {
                        setTimeout(() => {
                          suppressClickRef.current = false
                        }, 0)
                      }}
                      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${itemClassByGroup[item.group]}`}
                    >
                      <Icon className={`h-4 w-4 ${iconClassByGroup[item.group]}`} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}

export default BlocksLibraryPanel
