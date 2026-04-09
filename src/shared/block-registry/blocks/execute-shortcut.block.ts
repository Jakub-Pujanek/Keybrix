import { z } from 'zod'
import type { BlockDefinition } from '../types'

const ExecuteShortcutPayloadSchema = z
  .object({
    label: z.string().optional(),
    shortcut: z.string().trim().min(1).optional()
  })
  .passthrough()

export const executeShortcutBlockDefinition: BlockDefinition<'EXECUTE_SHORTCUT'> = {
  type: 'EXECUTE_SHORTCUT',
  group: 'inputKeys',
  labelKey: 'editor.library.blocks.executeShortcut',
  icon: 'keyboard',
  payloadSchema: ExecuteShortcutPayloadSchema
}
