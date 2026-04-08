import { z } from 'zod'
import type { BlockDefinition } from '../types'

const MouseClickPayloadSchema = z
  .object({
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    button: z.enum(['LEFT', 'RIGHT', 'MIDDLE']).optional()
  })
  .passthrough()

export const mouseClickBlockDefinition: BlockDefinition<'MOUSE_CLICK'> = {
  type: 'MOUSE_CLICK',
  group: 'mouseActions',
  labelKey: 'editor.library.blocks.mouseClick',
  icon: 'mousePointerClick',
  payloadSchema: MouseClickPayloadSchema
}
