import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarArrowDown,
  CalendarArrowUp,
  History,
  KeyRound,
  Package,
  Pencil,
  Trash2,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_LABEL } from '@/lib/constants'
import { countBelongings, formatDate, formatNaira, vehicleTitle } from '@/lib/format'
import type { VehicleWithOwner } from '@/types/database'

interface VehicleCardProps {
  vehicle: VehicleWithOwner
  /** Signed URL for the first picture, resolved once for the whole grid. */
  photoUrl?: string
  onMove: (vehicle: VehicleWithOwner) => void
  onHistory: (vehicle: VehicleWithOwner) => void
  onEdit: (vehicle: VehicleWithOwner) => void
  onDelete: (vehicle: VehicleWithOwner) => void
}

export function VehicleCard({
  vehicle,
  photoUrl,
  onMove,
  onHistory,
  onEdit,
  onDelete,
}: VehicleCardProps) {
  const navigate = useNavigate()
  const inStock = vehicle.status === 'in_stock'
  const open = () => navigate(`/vehicles/${vehicle.id}`)

  /** The card is the link; the buttons on it are not. */
  const stop = (handler: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    handler()
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open record for ${vehicleTitle(vehicle)}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      className="glass-tile-solid tile-interactive flex flex-col gap-4 rounded-[1.75rem] p-5 focus-visible:outline-none"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className="-m-1 h-36 w-[calc(100%+0.5rem)] rounded-[1.4rem] border border-white/40 object-cover"
        />
      ) : null}

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">
            {vehicleTitle(vehicle)}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{vehicle.owner?.full_name ?? 'Unknown owner'}</span>
          </p>
        </div>
        <Badge variant={inStock ? 'inStock' : 'released'} className="shrink-0">
          {STATUS_LABEL[vehicle.status]}
        </Badge>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <div className="col-span-2">
          <dt className="text-muted-foreground">VIN</dt>
          <dd className="truncate font-mono text-[0.78rem] tracking-tight">
            {vehicle.vin ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Colour</dt>
          <dd className="truncate font-medium">{vehicle.color ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plate</dt>
          <dd className="truncate font-medium">{vehicle.plate_number ?? '—'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <KeyRound className="size-3" /> Keys
          </dt>
          <dd className="font-medium">{vehicle.keys_count}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Package className="size-3" /> Belongings
          </dt>
          <dd className="font-medium">{countBelongings(vehicle.belongings)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <CalendarArrowDown className="size-3" /> In
          </dt>
          <dd className="font-medium">{formatDate(vehicle.intake_date)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <CalendarArrowUp className="size-3" /> Out
          </dt>
          <dd className="font-medium">{formatDate(vehicle.released_date)}</dd>
        </div>
      </dl>

      <div className="flex items-end justify-between gap-3 border-t border-white/40 pt-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Price</p>
          <p className="text-base font-semibold tracking-tight">
            {formatNaira(vehicle.price)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop(() => onHistory(vehicle))}
            aria-label={`Movement history for ${vehicleTitle(vehicle)}`}
            title="History"
          >
            <History />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop(() => onEdit(vehicle))}
            aria-label={`Edit ${vehicleTitle(vehicle)}`}
            title="Edit"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop(() => onDelete(vehicle))}
            aria-label={`Delete ${vehicleTitle(vehicle)}`}
            title="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <Button
        variant={inStock ? 'default' : 'outline'}
        size="sm"
        className="w-full"
        onClick={stop(() => onMove(vehicle))}
      >
        {inStock ? (
          <>
            <ArrowUpRight /> Release
          </>
        ) : (
          <>
            <ArrowDownLeft /> Check back in
          </>
        )}
      </Button>
    </article>
  )
}
