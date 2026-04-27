import Button from '../../primitives/Button'
import OverlayShell from '../../primitives/OverlayShell'

type ConfirmModalProps = {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isConfirming = false,
  onConfirm,
  onCancel
}: ConfirmModalProps): React.JSX.Element | null {
  return (
    <OverlayShell
      isOpen={isOpen}
      onClose={onCancel}
      closeDisabled={isConfirming}
      panelClassName="w-full max-w-md rounded-xl border border-(--kb-border) bg-(--kb-bg-surface) p-5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)]"
      panelTestId="confirm-modal"
    >
      <header>
        <h3 className="text-xl font-semibold text-(--kb-text-main)">{title}</h3>
        <p className="mt-2 text-sm text-(--kb-text-muted)">{description}</p>
      </header>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          className="bg-red-500 shadow-[0_8px_24px_-12px_rgba(220,38,38,0.55)] hover:bg-red-400"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {confirmLabel}
        </Button>
      </div>
    </OverlayShell>
  )
}

export default ConfirmModal
