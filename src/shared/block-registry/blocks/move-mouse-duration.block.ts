import { z } from 'zod'
import type { BlockDefinition } from '../types'

const MoveMouseDurationPayloadSchema = z
  .object({
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    durationMs: z.number().int().min(1).optional()
  })
  .passthrough()

export const moveMouseDurationBlockDefinition: BlockDefinition<'MOVE_MOUSE_DURATION'> = {
  type: 'MOVE_MOUSE_DURATION',
  group: 'mouseActions',
  labelKey: 'editor.library.blocks.moveMouseDuration',
  icon: 'mousePointerClick',
  payloadSchema: MoveMouseDurationPayloadSchema
}
