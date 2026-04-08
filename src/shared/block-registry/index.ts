import type { EditorBlockType } from '../api'
import { infiniteLoopBlockDefinition } from './blocks/infinite-loop.block'
import { mouseClickBlockDefinition } from './blocks/mouse-click.block'
import { pressKeyBlockDefinition } from './blocks/press-key.block'
import { repeatBlockDefinition } from './blocks/repeat.block'
import { startBlockDefinition } from './blocks/start.block'
import { typeTextBlockDefinition } from './blocks/type-text.block'
import { waitBlockDefinition } from './blocks/wait.block'
import type { BlockDefinition } from './types'

export const BLOCK_REGISTRY = [
  startBlockDefinition,
  pressKeyBlockDefinition,
  typeTextBlockDefinition,
  mouseClickBlockDefinition,
  waitBlockDefinition,
  repeatBlockDefinition,
  infiniteLoopBlockDefinition
] as const satisfies readonly BlockDefinition[]

export const BLOCK_REGISTRY_BY_TYPE: Readonly<Record<EditorBlockType, BlockDefinition>> =
  BLOCK_REGISTRY.reduce(
    (acc, item) => {
      acc[item.type] = item
      return acc
    },
    {} as Record<EditorBlockType, BlockDefinition>
  )

export const isRegisteredEditorBlockType = (value: string): value is EditorBlockType => {
  return value in BLOCK_REGISTRY_BY_TYPE
}

export type { BlockDefinition, BlockGroup, BlockIcon, BlockLabelKey } from './types'
