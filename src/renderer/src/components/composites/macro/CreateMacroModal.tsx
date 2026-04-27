import Button from '../../primitives/Button'
import OverlayShell from '../../primitives/OverlayShell'
import { useI18n } from '../../../lib/useI18n'

type CreateMacroModalProps = {
  isOpen: boolean
  name: string
  openNow: boolean
  isSubmitting: boolean
  validationError: string | null
  submitError: string | null
  onNameChange: (value: string) => void
  onOpenNowChange: (value: boolean) => void
  onClose: () => void
  onSubmit: () => void
}

function CreateMacroModal({
  isOpen,
  name,
  openNow,
  isSubmitting,
  validationError,
  submitError,
  onNameChange,
  onOpenNowChange,
  onClose,
  onSubmit
}: CreateMacroModalProps): React.JSX.Element | null {
  const { tx } = useI18n()

  return (
    <OverlayShell
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      panelClassName="w-full max-w-md rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) p-5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)]"
      panelTestId="create-macro-modal"
    >
      <header>
        <h3 className="text-xl font-semibold text-(--kb-text-main)">{tx('macro.newMacro')}</h3>
        <p className="mt-1 text-sm text-(--kb-text-muted)">{tx('macro.createModal.description')}</p>
      </header>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="block text-sm font-medium text-(--kb-text-main)">
          {tx('macro.createModal.nameLabel')}
          <input
            autoFocus
            data-testid="create-macro-name-input"
            value={name}
            maxLength={60}
            onChange={(event) => {
              onNameChange(event.target.value)
            }}
            className="mt-2 w-full rounded-md border border-(--kb-border) bg-(--kb-bg-overlay) px-3 py-2 text-sm text-(--kb-text-main) outline-none focus:border-[rgb(var(--kb-accent-rgb))]"
            placeholder={tx('macro.createModal.namePlaceholder')}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-(--kb-text-muted)">
          <input
            type="checkbox"
            checked={openNow}
            onChange={(event) => {
              onOpenNowChange(event.target.checked)
            }}
          />
          {tx('macro.createModal.openNow')}
        </label>

        {validationError ? <p className="text-xs text-red-300">{validationError}</p> : null}
        {!validationError && submitError ? (
          <p className="text-xs text-red-300">{submitError}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {tx('macro.createModal.actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? tx('macro.createModal.actions.creating')
              : tx('macro.createModal.actions.create')}
          </Button>
        </div>
      </form>
    </OverlayShell>
  )
}

export default CreateMacroModal
