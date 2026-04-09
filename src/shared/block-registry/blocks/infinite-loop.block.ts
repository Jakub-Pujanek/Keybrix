import { z } from 'zod'
import { RuntimeCommandSchema } from '../../api'
import { MAX_REPEAT_NESTED_COMMANDS } from '../../macro-runtime'
import type { BlockDefinition } from '../types'

const InfiniteLoopPayloadSchema = z
  .object({
    label: z.string().optional(),
    commands: z.array(RuntimeCommandSchema).max(MAX_REPEAT_NESTED_COMMANDS).optional()
  })
  .passthrough()

export const infiniteLoopBlockDefinition: BlockDefinition<'INFINITE_LOOP'> = {
  type: 'INFINITE_LOOP',
  group: 'logicFlow',
  labelKey: 'editor.library.blocks.infiniteLoop',
  icon: 'repeat2',
  payloadSchema: InfiniteLoopPayloadSchema
}
