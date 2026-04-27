import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'

type OverlayShellProps = PropsWithChildren<{
  isOpen: boolean
  onClose?: () => void
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  closeDisabled?: boolean
  zIndexClassName?: string
  containerClassName?: string
  panelClassName?: string
  panelTestId?: string
}>

function OverlayShell({
  isOpen,
  onClose,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  closeDisabled = false,
  zIndexClassName = 'z-[2000]',
  containerClassName,
  panelClassName,
  panelTestId,
  children
}: OverlayShellProps): React.JSX.Element | null {
  useEffect(() => {
    if (!isOpen || closeDisabled || !onClose || !closeOnEscape) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }

      onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeDisabled, closeOnEscape, isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-black/55 px-4 ${containerClassName ?? ''}`.trim()}
      onClick={() => {
        if (!closeOnBackdropClick || closeDisabled || !onClose) {
          return
        }

        onClose()
      }}
    >
      <article
        data-testid={panelTestId}
        className={panelClassName}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        {children}
      </article>
    </div>
  )
}

export default OverlayShell
