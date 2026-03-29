import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders keybrix ui', () => {
    render(<App />)
    expect(screen.getByText(/Keybrix \(Tailwind Ready\)/)).toBeInTheDocument()
  })
})
