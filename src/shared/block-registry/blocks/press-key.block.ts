import { z } from 'zod'
import type { BlockDefinition } from '../types'

const PressKeyPayloadSchema = z
  .object({
    label: z.string().optional(),
    key: z.string().trim().min(1).refine((value) => !value.includes('+')).optional(),
    keys: z.string().trim().min(1).refine((value) => !value.includes('+')).optional(),
    value: z.string().trim().min(1).refine((value) => !value.includes('+')).optional()
  })
  .passthrough()

export const pressKeyBlockDefinition: BlockDefinition<'PRESS_KEY'> = {
  type: 'PRESS_KEY',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.pressKey',
  icon: 'keyboard',
  payloadSchema: PressKeyPayloadSchema
}
