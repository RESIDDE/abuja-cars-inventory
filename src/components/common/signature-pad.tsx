import * as React from 'react'
import { Eraser, PenLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SignaturePadHandle {
  isEmpty: () => boolean
  toBlob: () => Promise<Blob | null>
  clear: () => void
}

type Point = { x: number; y: number }

interface SignaturePadProps {
  className?: string
  /** Shown faintly on the signing line. */
  hint?: string
  onChange?: (hasInk: boolean) => void
}

const HEIGHT = 170
const INK = 'hsl(160 14% 14%)'

/**
 * Captures a signature with a finger, stylus or mouse.
 *
 * Strokes are kept as points rather than drawn straight to the canvas, so the
 * drawing survives a resize or an orientation change — a canvas loses its
 * bitmap whenever its backing size changes, which would otherwise wipe a
 * signature when the keyboard opens.
 */
export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ className, hint, onChange }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const strokes = React.useRef<Point[][]>([])
    const current = React.useRef<Point[] | null>(null)
    const [hasInk, setHasInk] = React.useState(false)

    const redraw = React.useCallback(() => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return

      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(HEIGHT * ratio)
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, HEIGHT)
      context.lineWidth = 2.2
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = INK

      for (const stroke of strokes.current) {
        if (stroke.length === 0) continue
        context.beginPath()
        if (stroke.length === 1) {
          // A tap is a dot, not nothing.
          context.arc(stroke[0].x, stroke[0].y, 1.1, 0, Math.PI * 2)
          context.fillStyle = INK
          context.fill()
          continue
        }
        context.moveTo(stroke[0].x, stroke[0].y)
        for (let i = 1; i < stroke.length - 1; i += 1) {
          // Quadratic through the midpoints smooths the jitter of a finger.
          const mid = {
            x: (stroke[i].x + stroke[i + 1].x) / 2,
            y: (stroke[i].y + stroke[i + 1].y) / 2,
          }
          context.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y)
        }
        context.lineTo(stroke[stroke.length - 1].x, stroke[stroke.length - 1].y)
        context.stroke()
      }
    }, [])

    React.useEffect(() => {
      redraw()
      const canvas = canvasRef.current
      if (!canvas || typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(redraw)
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [redraw])

    const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      current.current = [pointFrom(event)]
      strokes.current.push(current.current)
      redraw()
    }

    const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!current.current) return
      current.current.push(pointFrom(event))
      redraw()
    }

    const end = () => {
      if (!current.current) return
      current.current = null
      if (!hasInk) {
        setHasInk(true)
        onChange?.(true)
      }
    }

    const clear = React.useCallback(() => {
      strokes.current = []
      current.current = null
      setHasInk(false)
      onChange?.(false)
      redraw()
    }, [onChange, redraw])

    React.useImperativeHandle(
      ref,
      () => ({
        isEmpty: () => strokes.current.length === 0,
        clear,
        toBlob: () =>
          new Promise<Blob | null>((resolve) => {
            const canvas = canvasRef.current
            if (!canvas || strokes.current.length === 0) return resolve(null)
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
          }),
      }),
      [clear],
    )

    return (
      <div className={cn('space-y-2', className)}>
        <div className="relative overflow-hidden rounded-2xl border border-white/45 bg-white/70">
          <canvas
            ref={canvasRef}
            style={{ height: HEIGHT }}
            // The page allows pan but not zoom; this canvas must own every
            // gesture on it, or a signature would scroll the dialog instead.
            className="block w-full touch-none"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
          />

          {!hasInk ? (
            <div className="pointer-events-none absolute inset-x-6 bottom-9 flex items-center gap-2 border-b border-dashed border-[hsl(160_10%_40%/.45)] pb-2 text-xs text-muted-foreground">
              <PenLine className="size-3.5" />
              {hint ?? 'Sign here'}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Sign with a finger, stylus or mouse.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={!hasInk}
          >
            <Eraser /> Clear
          </Button>
        </div>
      </div>
    )
  },
)
SignaturePad.displayName = 'SignaturePad'
