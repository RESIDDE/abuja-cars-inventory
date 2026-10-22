import { UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Owner } from '@/types/database'

interface OwnerMatchHintProps {
  matches: Owner[]
  /** Offered when the caller can switch to the existing record. */
  onUse?: (owner: Owner) => void
}

/**
 * Shown while a phone number is being typed, so the same person does not end up
 * on record twice. It suggests; it never blocks — two people genuinely do share
 * a number sometimes.
 */
export function OwnerMatchHint({ matches, onUse }: OwnerMatchHintProps) {
  if (matches.length === 0) return null

  return (
    <div className="rounded-xl border border-primary/50 bg-primary/20 px-3 py-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium">
        <UserCheck className="size-3.5 shrink-0" />
        {matches.length === 1
          ? 'That number is already on record'
          : `${matches.length} owners already have that number`}
      </p>

      <ul className="mt-2 space-y-1.5">
        {matches.map((owner) => (
          <li key={owner.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="font-medium">{owner.full_name}</span>
              <span className="ml-1.5 text-muted-foreground">{owner.phone_primary}</span>
            </span>
            {onUse ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onUse(owner)}>
                Use this owner
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {onUse ? null : (
        <p className="mt-2 text-muted-foreground">
          Carry on if this is a different person — it is only a warning.
        </p>
      )}
    </div>
  )
}
