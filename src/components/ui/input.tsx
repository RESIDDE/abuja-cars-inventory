import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-white/40 bg-white/40 px-4 py-2 text-sm text-foreground shadow-sm backdrop-blur-sm transition-colors',
        'placeholder:text-muted-foreground/80',
        'focus-visible:border-white/70 focus-visible:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
