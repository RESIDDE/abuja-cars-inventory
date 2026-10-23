import { useMemo } from 'react'

import { buildInventorySeries, custodyTotals } from '@/lib/analytics'
import { CHART_DAYS } from '@/lib/constants'
import { useOwners } from '@/hooks/use-owners'
import { useVehicles } from '@/hooks/use-vehicles'
import type { Owner, VehicleWithOwner } from '@/types/database'

// Stable identities, so the memo below doesn't recompute on every render while
// the queries are still in flight.
const NO_VEHICLES: VehicleWithOwner[] = []
const NO_OWNERS: Owner[] = []

export function useDashboardData() {
  const vehiclesQuery = useVehicles()
  const ownersQuery = useOwners()

  const vehicles = vehiclesQuery.data ?? NO_VEHICLES
  const owners = ownersQuery.data ?? NO_OWNERS

  const derived = useMemo(() => {
    const inStock = vehicles.filter((v) => v.status === 'in_stock')
    const released = vehicles.filter((v) => v.status === 'released')
    const sold = vehicles.filter((v) => v.status === 'sold')
    const series = buildInventorySeries(vehicles, CHART_DAYS)
    const totals = custodyTotals(inStock)
    const intakeLast30 = series.reduce((sum, day) => sum + day.checkedIn, 0)

    return {
      vehicles,
      inStock,
      released,
      sold,
      series,
      totals,
      intakeLast30,
      totalCount: vehicles.length,
      ownerCount: owners.length,
      stockRate: vehicles.length === 0 ? 0 : inStock.length / vehicles.length,
    }
  }, [vehicles, owners])

  return {
    ...derived,
    isLoading: vehiclesQuery.isLoading || ownersQuery.isLoading,
    isError: vehiclesQuery.isError || ownersQuery.isError,
    error: vehiclesQuery.error ?? ownersQuery.error,
    refetch: () => {
      void vehiclesQuery.refetch()
      void ownersQuery.refetch()
    },
  }
}
