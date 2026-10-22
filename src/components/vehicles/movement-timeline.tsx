import { ArrowDownLeft, ArrowUpRight, History, KeyRound } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VehicleEvent } from '@/types/database'

interface MovementTimelineProps {
  events: VehicleEvent[]
  isLoading?: boolean
  className?: string
}

/** Newest first, on a connecting rail. */
export function MovementTimeline({
  events,
  isLoading,
  className,
}: MovementTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-dashed border-white/50 px-4 py-6 text-sm text-muted-foreground',
          className,
        )}
      >
        <History className="size-4 shrink-0" />
        No movements recorded yet.
      </div>
    )
  }

  return (
    <ol className={cn('relative space-y-4 pl-9', className)}>
      {/* The rail */}
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-[13px] top-3 w-px bg-white/55"
      />

      {events.map((event) => {
        const released = event.event_type === 'released'
        const Icon = released ? ArrowUpRight : ArrowDownLeft
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                'absolute -left-9 top-1 grid size-7 place-items-center rounded-full border',
                released
                  ? 'border-white/50 bg-[hsl(160_12%_40%/.3)] text-[hsl(160_16%_20%)]'
                  : 'border-primary/50 bg-primary/40 text-primary-foreground',
              )}
            >
              <Icon className="size-3.5" />
            </span>

            <div className="glass-tile rounded-2xl px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium">
                  {released ? 'Released' : 'Checked in'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.occurred_at)}
                  <span className="mx-1.5 opacity-50">·</span>
                  {formatRelative(event.occurred_at)}
                </p>
              </div>

              {event.keys_count !== null ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-white/40 px-2.5 py-1 text-xs">
                  <KeyRound className="size-3 text-muted-foreground" />
                  <span className="font-medium">{event.keys_count}</span>
                  {released ? 'released' : 'brought back'}
                </p>
              ) : null}

              {event.staff_name || event.recipient_name ? (
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {event.staff_name ? (
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Staff</dt>
                      <dd className="font-medium">{event.staff_name}</dd>
                    </div>
                  ) : null}
                  {event.recipient_name ? (
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">
                        {released ? 'Released to' : 'Received from'}
                      </dt>
                      <dd className="font-medium">{event.recipient_name}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {event.notes ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  {event.notes}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
