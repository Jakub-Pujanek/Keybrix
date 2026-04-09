import { z } from 'zod'
import type { BlockDefinition } from '../types'

const AutoclickerTimedPayloadSchema = z
  .object({
    label: z.string().optional(),
    button: z.enum(['LEFT', 'RIGHT', 'MIDDLE']).optional(),
    frequencyMs: z.number().int().min(1).optional(),
    durationMs: z.number().int().min(1).optional()
  })
  .passthrough()

export const autoclickerTimedBlockDefinition: BlockDefinition<'AUTOCLICKER_TIMED'> = {
  type: 'AUTOCLICKER_TIMED',
  group: 'mouseActions',
  labelKey: 'editor.library.blocks.autoclickerTimed',
  icon: 'mousePointerClick',
  payloadSchema: AutoclickerTimedPayloadSchema
}
