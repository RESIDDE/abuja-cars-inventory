import { toDateInputValue } from '@/lib/format'
import type { VehicleWithOwner } from '@/types/database'

export interface InventoryDay {
  /** yyyy-MM-dd, used for keys and tooltips. */
  date: string
  /** "14 Mar" — the axis label. */
  label: string
  /** Vehicles checked in on that day. */
  checkedIn: number
  /** Vehicles still held at the end of that day. */
  held: number
}

/** The last `days` calendar days, oldest first, ending today. */
export function buildInventorySeries(
  vehicles: VehicleWithOwner[],
  days: number,
): InventoryDay[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const series: InventoryDay[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - offset)
    const key = toDateInputValue(day)

    let checkedIn = 0
    let held = 0

    for (const vehicle of vehicles) {
      const intake = vehicle.intake_date?.slice(0, 10)
      if (!intake) continue
      if (intake === key) checkedIn += 1
      const released = vehicle.released_date?.slice(0, 10) ?? null
      // Held at the end of that day: it had arrived, and either never left or
      // left on a later day.
      if (intake <= key && (released === null || released > key)) held += 1
    }

    series.push({
      date: key,
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      checkedIn,
      held,
    })
  }

  return series
}

export interface CustodyTotals {
  keys: number
  belongings: number
  stockValue: number
  pricedCount: number
}

/** Keys, checklist items and value for the vehicles currently held. */
export function custodyTotals(vehicles: VehicleWithOwner[]): CustodyTotals {
  return vehicles.reduce<CustodyTotals>(
    (totals, vehicle) => {
      totals.keys += vehicle.keys_count ?? 0
      totals.belongings += vehicle.belongings.reduce(
        (sum, b) => sum + (Number(b.qty) || 0),
        0,
      )
      if (vehicle.price !== null) {
        totals.stockValue += vehicle.price
        totals.pricedCount += 1
      }
      return totals
    },
    { keys: 0, belongings: 0, stockValue: 0, pricedCount: 0 },
  )
}
