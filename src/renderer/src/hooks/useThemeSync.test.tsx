import { render } from '@testing-library/react'
import { useThemeSync } from './useThemeSync'

type HarnessProps = {
  themeMode: 'DARK' | 'LIGHT'
  accentColor: 'blue' | 'orange' | 'violet' | 'green'
}

function Harness({ themeMode, accentColor }: HarnessProps): React.JSX.Element {
  useThemeSync(themeMode, accentColor)
  return <div data-testid="theme-sync-harness" />
}

describe('useThemeSync', () => {
  afterEach(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.style.removeProperty('--kb-accent-rgb')
  })

  it('applies dark class and blue accent variable', () => {
    render(<Harness themeMode="DARK" accentColor="blue" />)

    const root = document.documentElement
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.classList.contains('light')).toBe(false)
    expect(root.style.getPropertyValue('--kb-accent-rgb')).toBe('47 121 255')
  })

  it('switches to light class and updates accent variable', () => {
    const { rerender } = render(<Harness themeMode="DARK" accentColor="blue" />)

    rerender(<Harness themeMode="LIGHT" accentColor="green" />)

    const root = document.documentElement
    expect(root.classList.contains('light')).toBe(true)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.style.getPropertyValue('--kb-accent-rgb')).toBe('28 195 151')
  })
})
