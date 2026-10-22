import { ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ClickableTileProps {
  title: string
  subtitle?: string
  onActivate: () => void
  /** What a screen reader announces for the tile as a whole. */
  ariaLabel: string
  className?: string
  children: React.ReactNode
}

/**
 * Every dashboard tile is a target: hover lift, arrow affordance, keyboard
 * activation on Enter/Space and a visible focus ring. Rows nested inside one
 * must stopPropagation so they can open their own record instead.
 */
export function ClickableTile({
  title,
  subtitle,
  onActivate,
  ariaLabel,
  className,
  children,
}: ClickableTileProps) {
  return (
    <section
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onActivate()
        }
      }}
      className={cn(
        'group glass-tile-solid tile-interactive flex flex-col rounded-[1.75rem] p-5 focus-visible:outline-none',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold uppercase tracking-wide">{title}</h3>
          {subtitle ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/45 bg-white/40 text-foreground/70 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  )
}
