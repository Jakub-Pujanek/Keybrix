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
import {
  BLOCK_REGISTRY,
  type BlockGroup,
  type BlockIcon
} from '../../../../../shared/block-registry'
import { useI18n } from '../../../lib/useI18n'

type BlocksLibraryPanelProps = {
  onAddBlock: (type: EditorBlockType) => void
}

type GroupName = BlockGroup
type StringKey =
  | 'editor.library.blocks.start'
  | 'editor.library.blocks.pressKey'
  | 'editor.library.blocks.holdKey'
  | 'editor.library.blocks.executeShortcut'
  | 'editor.library.blocks.typeText'
  | 'editor.library.blocks.mouseClick'
  | 'editor.library.blocks.autoclickerTimed'
  | 'editor.library.blocks.autoclickerInfinite'
  | 'editor.library.blocks.moveMouseDuration'
  | 'editor.library.blocks.wait'
  | 'editor.library.blocks.repeat'
  | 'editor.library.blocks.infiniteLoop'

const groupOrder: GroupName[] = ['triggers', 'inputKeys', 'mouseActions', 'logicFlow']

type LibraryItem = {
  labelKey: StringKey
  type: EditorBlockType
  icon: React.ComponentType<{ className?: string }>
  group: GroupName
}

const iconMap: Record<BlockIcon, React.ComponentType<{ className?: string }>> = {
  moveRight: MoveRight,
  keyboard: Keyboard,
  textCursorInput: TextCursorInput,
  mousePointerClick: MousePointerClick,
  filter: Filter,
  repeat2: Repeat2
}

const items: LibraryItem[] = BLOCK_REGISTRY.map((item) => ({
  type: item.type,
  group: item.group,
  labelKey: item.labelKey,
  icon: iconMap[item.icon]
}))

const groupAccentClass: Record<GroupName, string> = {
  triggers: 'text-[rgb(var(--kb-accent-rgb))]',
  inputKeys: 'text-[rgb(var(--kb-accent-rgb)/0.78)]',
  mouseActions: 'text-[#f57a00]',
  logicFlow: 'text-[#00b58b]'
}

const itemClassByGroup: Record<GroupName, string> = {
  triggers:
    'border-[rgb(var(--kb-accent-rgb)/0.38)] bg-[var(--kb-bg-surface)] hover:border-[rgb(var(--kb-accent-rgb)/0.75)] hover:bg-[rgb(var(--kb-accent-rgb)/0.14)] text-[var(--kb-text-main)]',
  inputKeys:
    'border-[rgb(var(--kb-accent-rgb)/0.28)] bg-[var(--kb-bg-surface)] hover:border-[rgb(var(--kb-accent-rgb)/0.55)] hover:bg-[rgb(var(--kb-accent-rgb)/0.1)] text-[var(--kb-text-main)]',
  mouseActions:
    'border-[#c46612]/45 bg-[#32241f] hover:border-[#ef8d32] hover:bg-[#412b22] text-[#f7d7bd]',
  logicFlow:
    'border-[#108f75]/45 bg-[#182936] hover:border-[#11b798] hover:bg-[#1b3040] text-[#d0f5eb]'
}

const iconClassByGroup: Record<GroupName, string> = {
  triggers: 'text-[rgb(var(--kb-accent-rgb))]',
  inputKeys: 'text-[rgb(var(--kb-accent-rgb)/0.8)]',
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
    <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col rounded border border-(--kb-border) bg-(--kb-bg-panel) p-4">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-(--kb-text-muted) uppercase">
          {tx('editor.library.title')}
        </p>
        <Filter className="h-3 w-3 text-(--kb-text-muted)" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-6 pb-1">
          {groupOrder.map((group) => (
            <section key={group}>
              <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] uppercase">
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
      </div>
    </aside>
  )
}

export default BlocksLibraryPanel
