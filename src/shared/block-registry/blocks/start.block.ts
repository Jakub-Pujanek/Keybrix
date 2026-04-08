import { z } from 'zod'
import type { BlockDefinition } from '../types'

const StartPayloadSchema = z
  .object({
    label: z.string().optional(),
    shortcut: z.string().optional()
  })
  .passthrough()

export const startBlockDefinition: BlockDefinition<'START'> = {
  type: 'START',
  group: 'triggers',
  labelKey: 'editor.library.blocks.start',
  icon: 'moveRight',
  payloadSchema: StartPayloadSchema
}
