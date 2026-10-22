import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { describeDbError } from '@/lib/errors'

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  return (
    <div className="glass-tile-solid flex flex-col items-center gap-3 rounded-[1.75rem] px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-destructive/30 bg-destructive/15">
        <AlertTriangle className="size-6 text-destructive" />
      </span>
      <h3 className="text-base font-semibold">That didn&apos;t load</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{describeDbError(error)}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
