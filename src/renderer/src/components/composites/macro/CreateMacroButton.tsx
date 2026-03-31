import { Plus } from 'lucide-react'
import Button from '../../primitives/Button'

type CreateMacroButtonProps = {
  compact?: boolean
}

function CreateMacroButton({ compact = false }: CreateMacroButtonProps): React.JSX.Element {
  return (
    <Button
      variant="primary"
      className={compact ? 'h-12 w-full rounded-lg text-xs tracking-[0.14em] uppercase' : ''}
    >
      {compact ? (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Create Custom Block
        </>
      ) : (
        'New Macro'
      )}
    </Button>
  )
}

export default CreateMacroButton
