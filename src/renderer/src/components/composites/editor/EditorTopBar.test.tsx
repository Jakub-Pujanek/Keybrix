import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorTopBar from './EditorTopBar'

describe('EditorTopBar', () => {
  it('updates macro title on change', () => {
    const onMacroTitleChange = vi.fn()

    render(
      <EditorTopBar
        macroTitle="Macro"
        shortcut="CTRL + SHIFT + 1"
        isRecording={false}
        pressedPreview=""
        onMacroTitleChange={onMacroTitleChange}
        onStartShortcutRecording={() => undefined}
        onCancelShortcutRecording={() => undefined}
        onClear={() => undefined}
        onTestRun={() => undefined}
        onSave={() => undefined}
      />
    )

    const input = screen.getByLabelText('Macro title')
    fireEvent.change(input, { target: { value: 'Macro 2' } })

    expect(onMacroTitleChange).toHaveBeenCalledWith('Macro 2')
  })

  it('stops keydown propagation from macro title input', () => {
    const windowKeyDownSpy = vi.fn()
    window.addEventListener('keydown', windowKeyDownSpy)

    render(
      <EditorTopBar
        macroTitle="Macro"
        shortcut="CTRL + SHIFT + 1"
        isRecording={false}
        pressedPreview=""
        onMacroTitleChange={() => undefined}
        onStartShortcutRecording={() => undefined}
        onCancelShortcutRecording={() => undefined}
        onClear={() => undefined}
        onTestRun={() => undefined}
        onSave={() => undefined}
      />
    )

    const input = screen.getByLabelText('Macro title')
    fireEvent.keyDown(input, { key: 'A', code: 'KeyA' })

    expect(windowKeyDownSpy).not.toHaveBeenCalled()

    window.removeEventListener('keydown', windowKeyDownSpy)
  })
})
