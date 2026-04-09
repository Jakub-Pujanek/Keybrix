import { z } from 'zod'
import type { EditorBlockType } from '../api'

export const BlockGroupSchema = z.enum(['triggers', 'inputKeys', 'mouseActions', 'logicFlow'])
export type BlockGroup = z.infer<typeof BlockGroupSchema>

export type BlockIcon =
  | 'moveRight'
  | 'keyboard'
  | 'textCursorInput'
  | 'mousePointerClick'
  | 'filter'
  | 'repeat2'

export type BlockLabelKey =
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

export type BlockDefinition<TType extends EditorBlockType = EditorBlockType> = {
  type: TType
  group: BlockGroup
  labelKey: BlockLabelKey
  icon: BlockIcon
  payloadSchema: z.ZodType<Record<string, unknown>>
}
