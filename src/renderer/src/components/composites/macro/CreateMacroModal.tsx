import { useState } from 'react'
import Button from '../../primitives/Button'
import { useI18n } from '../../../lib/useI18n'

type CreateMacroModalProps = {
  isOpen: boolean
  isSubmitting: boolean
  submitError: string | null
  onClose: () => void
  onSubmit: (payload: { name: string; openNow: boolean }) => Promise<void>
}

function CreateMacroModal({
  isOpen,
  isSubmitting,
  submitError,
  onClose,
  onSubmit
}: CreateMacroModalProps): React.JSX.Element | null {
  const { tx } = useI18n()
  const [name, setName] = useState('')
  const [openNow, setOpenNow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4"
      onClick={() => {
        if (!isSubmitting) {
          onClose()
        }
      }}
    >
      <article
        className="w-full max-w-md rounded-xl border border-[var(--kb-border)] bg-[var(--kb-bg-surface)] p-5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)]"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <header>
          <h3 className="text-xl font-semibold text-[var(--kb-text-main)]">
            {tx('macro.newMacro')}
          </h3>
          <p className="mt-1 text-sm text-[var(--kb-text-muted)]">
            Enter a name for the new macro.
          </p>
        </header>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (trimmed.length === 0) {
              setError('Macro name is required.')
              return
            }

            setError(null)
            void onSubmit({ name: trimmed.slice(0, 60), openNow })
          }}
        >
          <label className="block text-sm font-medium text-[var(--kb-text-main)]">
            Macro name
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value)
              }}
              className="mt-2 w-full rounded-md border border-[var(--kb-border)] bg-[var(--kb-bg-overlay)] px-3 py-2 text-sm text-[var(--kb-text-main)] outline-none focus:border-[rgb(var(--kb-accent-rgb))]"
              placeholder="My New Macro"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--kb-text-muted)]">
            <input
              type="checkbox"
              checked={openNow}
              onChange={(event) => {
                setOpenNow(event.target.checked)
              }}
            />
            Open in editor right away
          </label>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          {!error && submitError ? <p className="text-xs text-red-300">{submitError}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create macro'}
            </Button>
          </div>
        </form>
      </article>
    </div>
  )
}

export default CreateMacroModal
