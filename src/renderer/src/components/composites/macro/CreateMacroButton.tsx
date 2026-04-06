import { Plus } from 'lucide-react'
import Button from '../../primitives/Button'
import { useI18n } from '../../../lib/useI18n'

type CreateMacroButtonProps = {
  compact?: boolean
}

function CreateMacroButton({ compact = false }: CreateMacroButtonProps): React.JSX.Element {
  const { tx } = useI18n()

  return (
    <Button
      variant="primary"
      className={compact ? 'h-12 w-full rounded-lg text-xs tracking-[0.14em] uppercase' : ''}
    >
      {compact ? (
        <>
          <Plus className="mr-2 h-4 w-4" />
          {tx('dashboard.createCustomBlock')}
        </>
      ) : (
        tx('macro.newMacro')
      )}
    </Button>
  )
}

export default CreateMacroButton
