import { z } from 'zod'
import { RuntimeCommandSchema } from '../../api'
import { MAX_REPEAT_ITERATIONS, MAX_REPEAT_NESTED_COMMANDS } from '../../macro-runtime'
import type { BlockDefinition } from '../types'

const RepeatPayloadSchema = z
  .object({
    label: z.string().optional(),
    count: z.number().int().min(1).max(MAX_REPEAT_ITERATIONS).optional(),
    commands: z.array(RuntimeCommandSchema).max(MAX_REPEAT_NESTED_COMMANDS).optional()
  })
  .passthrough()

export const repeatBlockDefinition: BlockDefinition<'REPEAT'> = {
  type: 'REPEAT',
  group: 'logicFlow',
  labelKey: 'editor.library.blocks.repeat',
  icon: 'repeat2',
  payloadSchema: RepeatPayloadSchema
}
