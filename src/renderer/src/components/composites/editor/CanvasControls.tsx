import { Minus, Plus, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../primitives/Button'
import { useI18n } from '../../../lib/useI18n'

type CanvasControlsProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomChange: (nextZoom: number) => void
}

function CanvasControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomChange
}: CanvasControlsProps): React.JSX.Element {
  const { tx } = useI18n()
  const [zoomInput, setZoomInput] = useState(String(Math.round(zoom * 100)))
  const [isSliderOpen, setIsSliderOpen] = useState(false)

  useEffect(() => {
    setZoomInput(String(Math.round(zoom * 100)))
  }, [zoom])

  const commitZoom = (): void => {
    const value = Number(zoomInput)
    if (!Number.isFinite(value)) {
      setZoomInput(String(Math.round(zoom * 100)))
      return
    }

    onZoomChange(value / 100)
  }

  return (
    <div className="absolute right-4 bottom-4 flex flex-col items-center gap-2">
      <Button
        variant="icon"
        onClick={onZoomIn}
        className="h-10 w-10 rounded-lg bg-(--kb-bg-surface) text-(--kb-text-main)"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="icon"
        onClick={onZoomOut}
        className="h-10 w-10 rounded-lg bg-(--kb-bg-surface) text-(--kb-text-main)"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        variant="icon"
        onClick={() => setIsSliderOpen((current) => !current)}
        className="h-10 w-10 rounded-lg bg-(--kb-bg-surface) text-(--kb-text-main)"
      >
        <Settings2 className="h-4 w-4" />
      </Button>
      {isSliderOpen ? (
        <div className="absolute right-12 bottom-12 w-36 rounded-lg border border-(--kb-border) bg-(--kb-bg-panel) p-3 shadow-xl backdrop-blur-sm">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.1em] text-(--kb-text-muted) uppercase">
            {tx('editor.canvas.zoom')}
          </p>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(event) => onZoomChange(Number(event.target.value) / 100)}
            className="w-full accent-[rgb(var(--kb-accent-rgb))]"
          />
        </div>
      ) : null}
      <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-(--kb-bg-surface) text-xs text-(--kb-text-muted)">
        <input
          value={zoomInput}
          onChange={(event) => setZoomInput(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitZoom}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitZoom()
            }
          }}
          className="w-8 bg-transparent text-right outline-none"
        />
        <span>%</span>
      </div>
    </div>
  )
}

export default CanvasControls
