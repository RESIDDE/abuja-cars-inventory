import * as React from 'react'
import { Car } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { CustodyTile } from '@/components/dashboard/custody-tile'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { IntakeChartTile } from '@/components/dashboard/intake-chart-tile'
import { RecentVehiclesTile } from '@/components/dashboard/recent-vehicles-tile'
import { StockGaugeTile } from '@/components/dashboard/stock-gauge-tile'
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { formatDate, formatNaira, vehicleTitle } from '@/lib/format'
import type { VehicleWithOwner } from '@/types/database'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = React.useState(false)

  const {
    vehicles,
    inStock,
    released,
    series,
    totals,
    intakeLast30,
    totalCount,
    ownerCount,
    stockRate,
    isLoading,
    isError,
    error,
    refetch,
  } = useDashboardData()

  if (isError) {
    return (
      <div className="page-enter">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-enter space-y-6">
        <Skeleton className="h-[26rem] rounded-[2rem]" />
        <Skeleton className="h-10 w-72 rounded-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[1.75rem] lg:col-span-2" />
          <Skeleton className="h-64 rounded-[1.75rem]" />
          <Skeleton className="h-56 rounded-[1.75rem] lg:col-span-2" />
          <Skeleton className="h-56 rounded-[1.75rem]" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-6">
      <DashboardHero
        totalCount={totalCount}
        inStockCount={inStock.length}
        releasedCount={released.length}
        ownerCount={ownerCount}
        series={series}
        onCheckIn={() => setFormOpen(true)}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="in_stock">In Stock</TabsTrigger>
          <TabsTrigger value="released">Released</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <RecentVehiclesTile vehicles={vehicles} />
            <StockGaugeTile
              rate={stockRate}
              inStockCount={inStock.length}
              totalCount={totalCount}
            />
            <IntakeChartTile
              series={series}
              total={intakeLast30}
              className="lg:col-span-2"
            />
            <CustodyTile totals={totals} inStockCount={inStock.length} />
          </div>
        </TabsContent>

        <TabsContent value="in_stock">
          <VehicleList
            vehicles={inStock}
            emptyTitle="Nothing on site"
            emptyDescription="Every vehicle on record has been released."
            onSeeAll={() => navigate('/vehicles?status=in_stock')}
          />
        </TabsContent>

        <TabsContent value="released">
          <VehicleList
            vehicles={released}
            emptyTitle="Nothing released yet"
            emptyDescription="Released vehicles will be listed here."
            onSeeAll={() => navigate('/vehicles?status=released')}
          />
        </TabsContent>
      </Tabs>

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}

function VehicleList({
  vehicles,
  emptyTitle,
  emptyDescription,
  onSeeAll,
}: {
  vehicles: VehicleWithOwner[]
  emptyTitle: string
  emptyDescription: string
  onSeeAll: () => void
}) {
  const navigate = useNavigate()

  if (vehicles.length === 0) {
    return <EmptyState icon={Car} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="glass-tile-solid rounded-[1.75rem] p-4 sm:p-5">
      <ul className="space-y-2">
        {vehicles.slice(0, 8).map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              onClick={() => navigate(`/vehicles/${vehicle.id}`)}
              className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-white/35 bg-white/30 px-4 py-3 text-left transition-colors hover:bg-white/55 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vehicleTitle(vehicle)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {vehicle.owner?.full_name ?? 'Unknown owner'}
                  {vehicle.plate_number ? ` · ${vehicle.plate_number}` : ''}
                </p>
              </div>
              <Badge variant="muted" className="shrink-0">
                In {formatDate(vehicle.intake_date)}
              </Badge>
              {vehicle.released_date ? (
                <Badge variant="muted" className="shrink-0">
                  Out {formatDate(vehicle.released_date)}
                </Badge>
              ) : null}
              <p className="shrink-0 text-sm font-semibold tracking-tight">
                {formatNaira(vehicle.price)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {vehicles.length > 8 ? (
        <Button variant="outline" className="mt-3 w-full" onClick={onSeeAll}>
          See all {vehicles.length}
        </Button>
      ) : null}
    </div>
  )
}
