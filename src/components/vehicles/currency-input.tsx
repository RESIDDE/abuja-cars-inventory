import * as React from 'react'

import { Input } from '@/components/ui/input'
import { groupDigits, parseCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CurrencyInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onChange: (value: number | null) => void
}

/** Groups thousands as you type and hands back a plain number. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() =>
      value === null ? '' : groupDigits(String(Math.round(value))),
    )

    // Keep up with resets and edits that come from outside (form.reset).
    React.useEffect(() => {
      setDisplay((current) => {
        if (parseCurrency(current) === value) return current
        return value === null ? '' : groupDigits(String(Math.round(value)))
      })
    }, [value])

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          ₦
        </span>
        <Input
          ref={ref}
          inputMode="numeric"
          autoComplete="off"
          className={cn('pl-8', className)}
          value={display}
          onChange={(event) => {
            const next = groupDigits(event.target.value)
            setDisplay(next)
            onChange(parseCurrency(next))
          }}
          {...props}
        />
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
