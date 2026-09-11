import { describe, expect, it } from 'vitest'
import type { EditorNode } from '../../../../shared/api'
import {
  buildSnapSpatialIndex,
  canCreateLoop,
  getChainFrom,
  getConnectedChildY,
  getNodeById,
  getSnapCandidate,
  getBlockTotalHeight,
  mapChainPositions
} from './canvasPhysics'

const buildNode = (
  id: string,
  type: EditorNode['type'],
  x: number,
  y: number,
  nextId: string | null = null
): EditorNode => ({
  id,
  type,
  x,
  y,
  nextId,
  payload: {}
})

describe('getBlockTotalHeight', () => {
  it('falls back to BODY_HEIGHT_BY_TYPE when no measurement exists', () => {
    const mouseClick = buildNode('mc', 'MOUSE_CLICK', 0, 0)
    const autoClickerTimed = buildNode('act', 'AUTOCLICKER_TIMED', 0, 0)
    const moveMouseDuration = buildNode('mmd', 'MOVE_MOUSE_DURATION', 0, 0)

    expect(getBlockTotalHeight(mouseClick)).toBe(120 + 12)
    expect(getBlockTotalHeight(autoClickerTimed)).toBe(136 + 12)
    expect(getBlockTotalHeight(moveMouseDuration)).toBe(152 + 12)
  })

  it('prefers the measured DOM height over the fallback table', () => {
    const node = buildNode('mc', 'MOUSE_CLICK', 0, 0)

    expect(getBlockTotalHeight(node, { mc: 200 })).toBe(200 + 12)
    expect(getBlockTotalHeight(node, { other: 200 })).toBe(120 + 12)
  })
})

describe('getConnectedChildY', () => {
  it('places the bottom notch below visually taller mouse action blocks', () => {
    const mouseClick = buildNode('mc', 'MOUSE_CLICK', 0, 100)
    const autoClickerTimed = buildNode('act', 'AUTOCLICKER_TIMED', 0, 100)
    const moveMouseDuration = buildNode('mmd', 'MOVE_MOUSE_DURATION', 0, 100)

    expect(getConnectedChildY(mouseClick)).toBe(100 + 120 + 12 - 11)
    expect(getConnectedChildY(autoClickerTimed)).toBe(100 + 136 + 12 - 11)
    expect(getConnectedChildY(moveMouseDuration)).toBe(100 + 152 + 12 - 11)
  })

  it('keeps standard blocks at 102px body height', () => {
    const pressKey = buildNode('pk', 'PRESS_KEY', 0, 100)
    const wait = buildNode('w', 'WAIT', 0, 100)

    expect(getConnectedChildY(pressKey)).toBe(100 + 102 + 12 - 11)
    expect(getConnectedChildY(wait)).toBe(100 + 102 + 12 - 11)
  })

  it('uses the measured height when provided', () => {
    const node = buildNode('n', 'WAIT', 0, 100)

    expect(getConnectedChildY(node, { n: 250 })).toBe(100 + 250 + 12 - 11)
  })
})

describe('getSnapCandidate', () => {
  it('allows another block to snap under a mouse action', () => {
    const mouseAction = buildNode('mouse', 'MOUSE_CLICK', 0, 0)
    const freeBlock = buildNode('free', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [mouseAction, freeBlock]

    const candidate = getSnapCandidate(
      nodes,
      freeBlock.id,
      mouseAction.x,
      getConnectedChildY(mouseAction),
      new Set(),
      buildSnapSpatialIndex(nodes)
    )

    expect(candidate).not.toBeNull()
    expect(candidate?.parentId).toBe(mouseAction.id)
  })

  it('allows a mouse action to snap under another block', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0)
    const mouseAction = buildNode('mouse', 'MOUSE_CLICK', 0, 0)
    const nodes: EditorNode[] = [parent, mouseAction]

    const candidate = getSnapCandidate(
      nodes,
      mouseAction.id,
      parent.x,
      getConnectedChildY(parent),
      new Set(),
      buildSnapSpatialIndex(nodes)
    )

    expect(candidate).not.toBeNull()
    expect(candidate?.parentId).toBe(parent.id)
  })

  it('works without a spatial index by scanning all nodes', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0)
    const dragged = buildNode('dragged', 'WAIT', 400, 400)
    const nodes: EditorNode[] = [parent, dragged]

    const candidate = getSnapCandidate(
      nodes,
      dragged.id,
      parent.x,
      getConnectedChildY(parent),
      new Set()
    )

    expect(candidate?.parentId).toBe(parent.id)
  })

  it('snaps to the measured bottom of a taller-than-fallback parent', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0)
    const dragged = buildNode('dragged', 'WAIT', 400, 400)
    const nodes: EditorNode[] = [parent, dragged]
    const heights = { parent: 300 }
    const expectedY = getConnectedChildY(parent, heights)

    const candidate = getSnapCandidate(
      nodes,
      dragged.id,
      parent.x,
      expectedY,
      new Set(),
      buildSnapSpatialIndex(nodes, heights),
      undefined,
      heights
    )

    expect(candidate?.parentId).toBe(parent.id)
    expect(candidate?.snapY).toBe(300 + 12 - 11)
  })

  it('does not snap where the fallback height would suggest when the parent is taller', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0)
    const dragged = buildNode('dragged', 'WAIT', 400, 400)
    const nodes: EditorNode[] = [parent, dragged]
    const heights = { parent: 300 }

    const candidate = getSnapCandidate(
      nodes,
      dragged.id,
      parent.x,
      getConnectedChildY(parent),
      new Set(),
      buildSnapSpatialIndex(nodes, heights),
      undefined,
      heights
    )

    expect(candidate).toBeNull()
  })

  it('prevents START from snapping under any block', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0)
    const start = buildNode('start', 'START', 0, 0)
    const nodes: EditorNode[] = [parent, start]

    const candidate = getSnapCandidate(
      nodes,
      start.id,
      parent.x,
      getConnectedChildY(parent),
      new Set(),
      buildSnapSpatialIndex(nodes)
    )

    expect(candidate).toBeNull()
  })

  it('prevents creating a loop', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0, 'c')
    const c = buildNode('c', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [a, b, c]

    const candidate = getSnapCandidate(
      nodes,
      a.id,
      c.x,
      getConnectedChildY(c),
      new Set(),
      buildSnapSpatialIndex(nodes)
    )

    expect(candidate).toBeNull()
  })

  it('trusts a pre-seeded loop cache instead of recomputing', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0, 'c')
    const c = buildNode('c', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [a, b, c]
    const loopCache = new Map<string, boolean>([['c->a', false]])

    const candidate = getSnapCandidate(
      nodes,
      a.id,
      c.x,
      getConnectedChildY(c),
      new Set(),
      buildSnapSpatialIndex(nodes),
      loopCache
    )

    expect(candidate?.parentId).toBe(c.id)
  })

  it('excludes the dragged chain from candidates', () => {
    const parent = buildNode('parent', 'WAIT', 0, 0, 'child')
    const child = buildNode('child', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [parent, child]

    const candidate = getSnapCandidate(
      nodes,
      parent.id,
      child.x,
      getConnectedChildY(child),
      new Set([parent.id, child.id]),
      buildSnapSpatialIndex(nodes)
    )

    expect(candidate).toBeNull()
  })
})

describe('canCreateLoop', () => {
  it('detects a cycle in the chain', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0, 'c')
    const c = buildNode('c', 'WAIT', 0, 0, 'a')
    const nodes: EditorNode[] = [a, b, c]

    expect(canCreateLoop(nodes, 'c', 'a')).toBe(true)
  })

  it('returns false for a non-cyclic chain', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0)
    const c = buildNode('c', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [a, b, c]

    expect(canCreateLoop(nodes, 'c', 'a')).toBe(false)
  })
})

describe('getChainFrom', () => {
  it('returns the connected chain in order', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0, 'c')
    const c = buildNode('c', 'WAIT', 0, 0)
    const nodes: EditorNode[] = [a, b, c]

    expect(getChainFrom(nodes, 'a')).toEqual(['a', 'b', 'c'])
  })

  it('terminates on a cyclic chain', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'b')
    const b = buildNode('b', 'WAIT', 0, 0, 'a')
    const nodes: EditorNode[] = [a, b]

    expect(getChainFrom(nodes, 'a')).toEqual(['a', 'b'])
  })

  it('stops when nextId points to a missing node', () => {
    const a = buildNode('a', 'WAIT', 0, 0, 'ghost')

    expect(getChainFrom([a], 'a')).toEqual(['a'])
  })
})

describe('mapChainPositions', () => {
  it('applies drag delta and snap adjustment to every chain node', () => {
    const initialPositions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 30, y: 40 }]
    ])

    expect(mapChainPositions(['a', 'b'], initialPositions, 5, 7, 1, 2)).toEqual([
      { id: 'a', x: 16, y: 29 },
      { id: 'b', x: 36, y: 49 }
    ])
  })

  it('drops nodes missing an initial position', () => {
    const initialPositions = new Map([['a', { x: 10, y: 20 }]])

    expect(mapChainPositions(['a', 'missing'], initialPositions, 5, 7)).toEqual([
      { id: 'a', x: 15, y: 27 }
    ])
  })
})

describe('buildSnapSpatialIndex', () => {
  it('buckets nodes by their snap target cell', () => {
    const near = buildNode('near', 'WAIT', 0, 0)
    const far = buildNode('far', 'WAIT', 500, 0)

    const index = buildSnapSpatialIndex([near, far])

    expect(index.buckets.get('0:0')).toEqual([near])
    expect(index.buckets.get('2:0')).toEqual([far])
  })

  it('buckets by measured height when provided', () => {
    const node = buildNode('n', 'WAIT', 0, 0)

    const index = buildSnapSpatialIndex([node], { n: 500 })

    expect(index.buckets.get('0:2')).toEqual([node])
    expect(index.buckets.has('0:0')).toBe(false)
  })
})

describe('getNodeById', () => {
  it('returns the node with the given id', () => {
    const node = buildNode('n1', 'WAIT', 0, 0)
    expect(getNodeById([node], 'n1')).toBe(node)
  })

  it('returns undefined for unknown id', () => {
    expect(getNodeById([], 'n1')).toBeUndefined()
  })
})
