import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-2xl border border-white/40 bg-white/40 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur-sm transition-colors',
      'placeholder:text-muted-foreground/80',
      'focus-visible:border-white/70 focus-visible:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
