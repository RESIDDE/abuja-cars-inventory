import { Car, Mail, MapPin, Pencil, Phone, ShoppingBag, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatNaira, initialsOf, telHref, vehicleTitle } from '@/lib/format'
import type { Owner, VehicleWithOwner } from '@/types/database'

interface OwnerCardProps {
  owner: Owner
  vehicleCount: number
  /** Vehicles this customer has bought from the yard. */
  purchases?: VehicleWithOwner[]
  onEdit: (owner: Owner) => void
  onDelete: (owner: Owner) => void
}

export function OwnerCard({
  owner,
  vehicleCount,
  purchases = [],
  onEdit,
  onDelete,
}: OwnerCardProps) {
  const navigate = useNavigate()

  const stop = (handler: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    handler()
  }

  return (
    <article className="glass-tile-solid flex flex-col gap-4 rounded-[1.75rem] p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/50 bg-white/55 text-sm font-semibold">
          {initialsOf(owner.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight">
            {owner.full_name}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="muted">
              <Car className="size-3" />
              {vehicleCount} stored
            </Badge>
            {purchases.length > 0 ? (
              <Badge variant="inStock">
                <ShoppingBag className="size-3" />
                {purchases.length} bought
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop(() => onEdit(owner))}
            aria-label={`Edit ${owner.full_name}`}
            title="Edit"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop(() => onDelete(owner))}
            aria-label={`Delete ${owner.full_name}`}
            title="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="space-y-2 text-sm">
        <a
          href={telHref(owner.phone_primary)}
          className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-3.5 py-2 transition-colors hover:bg-white/55"
        >
          <Phone className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{owner.phone_primary}</span>
        </a>
        {owner.phone_secondary ? (
          <a
            href={telHref(owner.phone_secondary)}
            className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-3.5 py-2 transition-colors hover:bg-white/55"
          >
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{owner.phone_secondary}</span>
          </a>
        ) : null}
        {owner.email ? (
          <a
            href={`mailto:${owner.email}`}
            className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-3.5 py-2 transition-colors hover:bg-white/55"
          >
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{owner.email}</span>
          </a>
        ) : null}
        {owner.address ? (
          <p className="flex items-start gap-2.5 px-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span>{owner.address}</span>
          </p>
        ) : null}
      </div>

      {purchases.length > 0 ? (
        <div className="rounded-2xl border border-white/40 bg-white/25 p-3">
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Bought from you
          </p>
          <ul className="space-y-1.5">
            {purchases.map((vehicle) => (
              <li key={vehicle.id}>
                <button
                  type="button"
                  onClick={stop(() => navigate(`/vehicles/${vehicle.id}`))}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/55"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {vehicleTitle(vehicle)}
                    <span className="block text-[0.7rem] text-muted-foreground">
                      {formatDate(vehicle.sold_date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatNaira(vehicle.sale_price ?? vehicle.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vehicleCount > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/vehicles?owner=${owner.id}`)}
        >
          <Car /> View their vehicles
        </Button>
      ) : null}
    </article>
  )
}
