import { z } from 'zod'
import type { BlockDefinition } from '../types'

const PressKeyPayloadSchema = z
  .object({
    label: z.string().optional(),
    key: z
      .string()
      .trim()
      .min(1)
      .regex(/^[^+]+$/)
      .optional(),
    keys: z
      .string()
      .trim()
      .min(1)
      .regex(/^[^+]+$/)
      .optional(),
    value: z
      .string()
      .trim()
      .min(1)
      .regex(/^[^+]+$/)
      .optional()
  })
  .passthrough()

export const pressKeyBlockDefinition: BlockDefinition<'PRESS_KEY'> = {
  type: 'PRESS_KEY',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.pressKey',
  icon: 'keyboard',
  payloadSchema: PressKeyPayloadSchema
}
