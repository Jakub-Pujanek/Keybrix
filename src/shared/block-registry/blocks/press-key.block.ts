import { z } from 'zod'
import type { BlockDefinition } from '../types'

const PressKeyPayloadSchema = z
  .object({
    label: z.string().optional(),
    key: z.string().optional(),
    keys: z.string().optional(),
    value: z.string().optional()
  })
  .passthrough()

export const pressKeyBlockDefinition: BlockDefinition<'PRESS_KEY'> = {
  type: 'PRESS_KEY',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.pressKey',
  icon: 'keyboard',
  payloadSchema: PressKeyPayloadSchema
}
