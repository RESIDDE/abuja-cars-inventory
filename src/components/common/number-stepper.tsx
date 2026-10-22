import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  /** Announced to screen readers, since the buttons are just icons. */
  label: string
  className?: string
}

/**
 * Tap targets rather than a text field — this gets used one-handed, standing
 * next to a car, often on a phone.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  className,
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const set = (next: number) => onChange(clamp(Number.isFinite(next) ? next : min))

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-2xl border border-white/45 bg-white/35 p-1',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
        className="grid size-9 place-items-center rounded-xl text-foreground transition-colors hover:bg-white/70 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Minus className="size-4" />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
        aria-label={label}
        className="w-12 bg-transparent text-center text-base font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className="grid size-9 place-items-center rounded-xl text-foreground transition-colors hover:bg-white/70 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
