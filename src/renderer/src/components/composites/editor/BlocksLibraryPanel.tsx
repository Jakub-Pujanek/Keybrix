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
import { useI18n } from '../../../lib/useI18n'

type BlocksLibraryPanelProps = {
  onAddBlock: (type: EditorBlockType) => void
}

type LibraryItem = {
  labelKey: StringKey
  type: EditorBlockType
  icon: React.ComponentType<{ className?: string }>
  group: GroupName
}

type GroupName = 'triggers' | 'inputKeys' | 'mouseActions' | 'logicFlow'
type StringKey =
  | 'editor.library.blocks.start'
  | 'editor.library.blocks.pressKey'
  | 'editor.library.blocks.typeText'
  | 'editor.library.blocks.mouseClick'
  | 'editor.library.blocks.wait'
  | 'editor.library.blocks.repeat'
  | 'editor.library.blocks.infiniteLoop'

const items: LibraryItem[] = [
  { labelKey: 'editor.library.blocks.start', type: 'START', icon: MoveRight, group: 'triggers' },
  {
    labelKey: 'editor.library.blocks.pressKey',
    type: 'PRESS_KEY',
    icon: Keyboard,
    group: 'inputKeys'
  },
  {
    labelKey: 'editor.library.blocks.typeText',
    type: 'TYPE_TEXT',
    icon: TextCursorInput,
    group: 'inputKeys'
  },
  {
    labelKey: 'editor.library.blocks.mouseClick',
    type: 'MOUSE_CLICK',
    icon: MousePointerClick,
    group: 'mouseActions'
  },
  { labelKey: 'editor.library.blocks.wait', type: 'WAIT', icon: Filter, group: 'logicFlow' },
  {
    labelKey: 'editor.library.blocks.repeat',
    type: 'REPEAT',
    icon: Repeat2,
    group: 'logicFlow'
  },
  {
    labelKey: 'editor.library.blocks.infiniteLoop',
    type: 'INFINITE_LOOP',
    icon: Repeat2,
    group: 'logicFlow'
  }
]

const groupOrder: LibraryItem['group'][] = ['triggers', 'inputKeys', 'mouseActions', 'logicFlow']

const groupAccentClass: Record<GroupName, string> = {
  triggers: 'text-[#506cff]',
  inputKeys: 'text-[#8ea5ff]',
  mouseActions: 'text-[#f57a00]',
  logicFlow: 'text-[#00b58b]'
}

const itemClassByGroup: Record<GroupName, string> = {
  triggers:
    'border-[#3152c5]/40 bg-[#1d2539] hover:border-[#4a6fff] hover:bg-[#202c46] text-slate-100',
  inputKeys:
    'border-[#3c57ba]/40 bg-[#1d2539] hover:border-[#5f7fff] hover:bg-[#1f2c4b] text-slate-100',
  mouseActions:
    'border-[#c46612]/45 bg-[#32241f] hover:border-[#ef8d32] hover:bg-[#412b22] text-[#f7d7bd]',
  logicFlow:
    'border-[#108f75]/45 bg-[#182936] hover:border-[#11b798] hover:bg-[#1b3040] text-[#d0f5eb]'
}

const iconClassByGroup: Record<GroupName, string> = {
  triggers: 'text-[#9bb4ff]',
  inputKeys: 'text-[#b8c7ff]',
  mouseActions: 'text-[#ff9a3f]',
  logicFlow: 'text-[#11c7a3]'
}

function BlocksLibraryPanel({ onAddBlock }: BlocksLibraryPanelProps): React.JSX.Element {
  const suppressClickRef = useRef(false)
  const { tx } = useI18n()

  const groupLabelMap: Record<GroupName, string> = {
    triggers: tx('editor.library.groups.triggers'),
    inputKeys: tx('editor.library.groups.inputKeys'),
    mouseActions: tx('editor.library.groups.mouseActions'),
    logicFlow: tx('editor.library.groups.logicFlow')
  }

  return (
    <aside className="w-[245px] rounded border border-white/10 bg-[#141d31]/95 p-4">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
          {tx('editor.library.title')}
        </p>
        <Filter className="h-3 w-3 text-slate-500" />
      </div>

      <div className="space-y-6">
        {groupOrder.map((group) => (
          <section key={group}>
            <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-[#506cff] uppercase">
              <span className={groupAccentClass[group]}>{groupLabelMap[group]}</span>
            </h3>
            <div className="space-y-2">
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={`${group}-${item.labelKey}`}
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
                      <span>{tx(item.labelKey)}</span>
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
