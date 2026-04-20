import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorNode } from '../../../../../shared/api'
import ActionBlock from './ActionBlock'

const buildNode = (
  type: EditorNode['type'],
  payload: Record<string, unknown> = {}
): EditorNode => ({
  id: 'node-1',
  type,
  x: 0,
  y: 0,
  nextId: null,
  payload
})

const renderActionBlock = (
  node: EditorNode,
  onUpdatePayload: (nodeId: string, nextPayload: Record<string, unknown>) => void
): void => {
  render(
    <ActionBlock
      node={node}
      isSelected={false}
      isRecordingShortcut={false}
      pressedPreview=""
      highlightTopNotch={false}
      highlightBottomNotch={false}
      onStartShortcutRecording={() => undefined}
      onCancelShortcutRecording={() => undefined}
      onUpdatePayload={onUpdatePayload}
      mousePickerTargetNodeId={null}
      mousePickerPreview={null}
      isMousePickerActive={false}
      onStartMousePicker={() => undefined}
      onStopMousePicker={() => undefined}
    />
  )
}

describe('ActionBlock mouse inputs', () => {
  it('sanitizes non-finite and negative coordinates for MOUSE_CLICK', () => {
    const onUpdatePayload = vi.fn()
    renderActionBlock(buildNode('MOUSE_CLICK', {}), onUpdatePayload)

    const [xInput, yInput] = screen.getAllByRole('spinbutton')

    fireEvent.change(xInput, { target: { value: 'Infinity' } })
    fireEvent.change(yInput, { target: { value: '-12.6' } })

    expect(onUpdatePayload).toHaveBeenNthCalledWith(1, 'node-1', { x: 0 })
    expect(onUpdatePayload).toHaveBeenNthCalledWith(2, 'node-1', { y: 0 })
  })

  it('shows mouse autoclicker defaults and enforces positive integer values', () => {
    const onUpdatePayload = vi.fn()
    renderActionBlock(buildNode('AUTOCLICKER_TIMED', {}), onUpdatePayload)

    const [frequencyInput, durationInput] = screen.getAllByRole('spinbutton')

    expect((frequencyInput as HTMLInputElement).value).toBe('100')
    expect((durationInput as HTMLInputElement).value).toBe('1000')

    fireEvent.change(frequencyInput, { target: { value: 'Infinity' } })
    fireEvent.change(durationInput, { target: { value: '0' } })

    expect(onUpdatePayload).toHaveBeenNthCalledWith(1, 'node-1', { frequencyMs: 1 })
    expect(onUpdatePayload).toHaveBeenNthCalledWith(2, 'node-1', { durationMs: 1 })
  })

  it('uses dedicated move-mouse default duration', () => {
    const onUpdatePayload = vi.fn()
    renderActionBlock(buildNode('MOVE_MOUSE_DURATION', {}), onUpdatePayload)

    const [, , durationInput] = screen.getAllByRole('spinbutton')
    expect((durationInput as HTMLInputElement).value).toBe('250')
  })
})
