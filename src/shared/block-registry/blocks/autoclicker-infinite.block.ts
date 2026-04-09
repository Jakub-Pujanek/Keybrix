import { z } from 'zod'
import type { BlockDefinition } from '../types'

const AutoclickerInfinitePayloadSchema = z
  .object({
    label: z.string().optional(),
    button: z.enum(['LEFT', 'RIGHT', 'MIDDLE']).optional(),
    frequencyMs: z.number().int().min(1).optional()
  })
  .passthrough()

export const autoclickerInfiniteBlockDefinition: BlockDefinition<'AUTOCLICKER_INFINITE'> = {
  type: 'AUTOCLICKER_INFINITE',
  group: 'mouseActions',
  labelKey: 'editor.library.blocks.autoclickerInfinite',
  icon: 'mousePointerClick',
  payloadSchema: AutoclickerInfinitePayloadSchema
}
