import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-white/40 bg-white/45 text-foreground',
        inStock:
          'border-primary/50 bg-primary/35 text-primary-foreground',
        released:
          'border-white/45 bg-[hsl(160_12%_38%/.22)] text-[hsl(160_14%_22%)]',
        outline: 'border-white/50 bg-transparent text-foreground',
        muted: 'border-white/30 bg-white/25 text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
