import { z } from 'zod'
import type { BlockDefinition } from '../types'

const HoldKeyPayloadSchema = z
  .object({
    label: z.string().optional(),
    key: z.string().trim().min(1).refine((value) => !value.includes('+')).optional(),
    durationMs: z.number().int().min(1).optional()
  })
  .passthrough()

export const holdKeyBlockDefinition: BlockDefinition<'HOLD_KEY'> = {
  type: 'HOLD_KEY',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.holdKey',
  icon: 'keyboard',
  payloadSchema: HoldKeyPayloadSchema
}
