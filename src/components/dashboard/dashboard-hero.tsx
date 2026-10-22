import { ChevronRight, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { InventoryChart } from '@/components/dashboard/inventory-chart'
import { Button } from '@/components/ui/button'
import { CHART_DAYS } from '@/lib/constants'
import { initialsOf } from '@/lib/format'
import type { InventoryDay } from '@/lib/analytics'

interface DashboardHeroProps {
  email: string
  totalCount: number
  inStockCount: number
  releasedCount: number
  ownerCount: number
  series: InventoryDay[]
  onCheckIn: () => void
}

export function DashboardHero({
  email,
  totalCount,
  inStockCount,
  releasedCount,
  ownerCount,
  series,
  onCheckIn,
}: DashboardHeroProps) {
  const navigate = useNavigate()

  const legend = [
    {
      label: 'Held now',
      value: inStockCount,
      swatch: 'bg-primary',
      to: '/vehicles?status=in_stock',
    },
    {
      label: 'Released',
      value: releasedCount,
      swatch: 'bg-white/85',
      to: '/vehicles?status=released',
    },
    {
      label: 'Owners',
      value: ownerCount,
      swatch: 'bg-[hsl(160_14%_35%)]',
      to: '/owners',
    },
  ]

  return (
    <section className="glass-hero rounded-[2rem] p-5 sm:p-8">
      {/* Top row: who you are and what you can do, against the greeting. */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-2.5 rounded-full border border-white/45 bg-white/45 py-1.5 pl-1.5 pr-4">
            <span className="grid size-8 place-items-center rounded-full bg-[hsl(160_14%_30%)] text-[0.7rem] font-semibold uppercase text-white">
              {initialsOf(email || 'AbujaCar')}
            </span>
            <span className="max-w-[9rem] truncate text-xs font-medium sm:max-w-[14rem]">
              {email || 'Staff'}
            </span>
          </span>

          <Button onClick={onCheckIn} className="h-10">
            <Plus /> Check in vehicle
          </Button>

          <button
            type="button"
            onClick={() => navigate('/vehicles')}
            aria-label="Search the inventory"
            className="icon-button-frosted grid size-10 place-items-center rounded-full text-foreground/80 transition-colors hover:text-foreground"
          >
            <Search className="size-4" />
          </button>
        </div>

        <div className="ml-auto text-right">
          <p className="text-2xl tracking-tight sm:text-[1.75rem]">Hey there!</p>
          <p className="text-sm font-light text-muted-foreground sm:text-base">
            Explore your inventory history
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
        {/* The headline number and the legend */}
        <div>
          <p className="text-sm text-muted-foreground">All Vehicles</p>
          <p className="text-display mt-1 text-[4.5rem] sm:text-[5.5rem]">{totalCount}</p>

          <ul className="mt-5 space-y-1">
            {legend.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={() => navigate(row.to)}
                  className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/35 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${row.swatch}`}
                  />
                  <span className="flex-1 text-sm">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{row.value}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* The chart */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Last {CHART_DAYS} days</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2 rounded-sm bg-white/90" />
                Checked in
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-primary" />
                Still held
              </span>
            </div>
          </div>
          <InventoryChart data={series} />
        </div>
      </div>
    </section>
  )
}
