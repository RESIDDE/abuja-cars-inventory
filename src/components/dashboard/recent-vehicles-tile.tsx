import { useNavigate } from 'react-router-dom'

import { ClickableTile } from '@/components/dashboard/clickable-tile'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL } from '@/lib/constants'
import { formatDate, formatNaira, vehicleTitle } from '@/lib/format'
import type { VehicleWithOwner } from '@/types/database'

export function RecentVehiclesTile({ vehicles }: { vehicles: VehicleWithOwner[] }) {
  const navigate = useNavigate()
  const recent = vehicles.slice(0, 4)

  return (
    <ClickableTile
      title="Recent vehicles"
      subtitle="Newest records first"
      ariaLabel="See all vehicles"
      onActivate={() => navigate('/vehicles')}
      className="lg:col-span-2"
    >
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing checked in yet. The first record will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.map((vehicle) => (
            <li key={vehicle.id}>
              {/* Nested in a clickable tile, so this stops the event from
                  bubbling and opens its own record instead. */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/vehicles/${vehicle.id}`)
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/35 bg-white/30 px-3.5 py-2.5 text-left transition-colors hover:bg-white/55 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{vehicleTitle(vehicle)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vehicle.owner?.full_name ?? 'Unknown owner'}
                    <span className="mx-1.5 opacity-50">·</span>
                    {formatDate(vehicle.intake_date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tracking-tight">
                    {formatNaira(vehicle.price)}
                  </p>
                  <Badge
                    variant={vehicle.status === 'in_stock' ? 'inStock' : 'released'}
                    className="mt-1 px-2 py-0.5 text-[0.65rem]"
                  >
                    {STATUS_LABEL[vehicle.status]}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ClickableTile>
  )
}
