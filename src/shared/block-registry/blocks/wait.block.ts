import { z } from 'zod'
import type { BlockDefinition } from '../types'

const WaitPayloadSchema = z
  .object({
    label: z.string().optional(),
    durationMs: z.number().optional()
  })
  .passthrough()

export const waitBlockDefinition: BlockDefinition<'WAIT'> = {
  type: 'WAIT',
  group: 'logicFlow',
  labelKey: 'editor.library.blocks.wait',
  icon: 'filter',
  payloadSchema: WaitPayloadSchema
}
