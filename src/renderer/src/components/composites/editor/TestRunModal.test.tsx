import { render, screen } from '@testing-library/react'
import TestRunModal from './TestRunModal'
import { useSettingsStore } from '../../../store/settings.store'
import { DEFAULT_APP_SETTINGS } from '../../../../../shared/api'

describe('TestRunModal i18n', () => {
  const setLanguage = (language: 'POLSKI' | 'ENGLISH'): void => {
    useSettingsStore.setState({
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        language
      },
      isLoading: false,
      language
    })
  }

  it('renders Polish copy for idle test modal', () => {
    setLanguage('POLSKI')

    render(
      <TestRunModal
        isOpen
        isRunning={false}
        status="IDLE"
        sessionId={null}
        reasonCode={null}
        sandboxText=""
        logs={[]}
        error={null}
        onSandboxTextChange={() => undefined}
        onRun={async () => undefined}
        onStop={async () => undefined}
        onClose={() => undefined}
      />
    )

    expect(screen.getByText('Test makra na zywo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uruchom test teraz' })).toBeInTheDocument()
    expect(screen.getByText('Oczekuje')).toBeInTheDocument()
    expect(screen.getByText('Brak logow. Uruchom test makra.')).toBeInTheDocument()
  })

  it('renders English copy for idle test modal', () => {
    setLanguage('ENGLISH')

    render(
      <TestRunModal
        isOpen
        isRunning={false}
        status="IDLE"
        sessionId={null}
        reasonCode={null}
        sandboxText=""
        logs={[]}
        error={null}
        onSandboxTextChange={() => undefined}
        onRun={async () => undefined}
        onStop={async () => undefined}
        onClose={() => undefined}
      />
    )

    expect(screen.getByText('Live macro test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run test now' })).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
    expect(screen.getByText('No logs yet. Run macro test.')).toBeInTheDocument()
  })
})
