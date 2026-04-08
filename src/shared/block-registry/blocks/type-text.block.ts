import { z } from 'zod'
import type { BlockDefinition } from '../types'

const TypeTextPayloadSchema = z
  .object({
    label: z.string().optional(),
    text: z.string().optional(),
    value: z.string().optional()
  })
  .passthrough()

export const typeTextBlockDefinition: BlockDefinition<'TYPE_TEXT'> = {
  type: 'TYPE_TEXT',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.typeText',
  icon: 'textCursorInput',
  payloadSchema: TypeTextPayloadSchema
}
