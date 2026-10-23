import * as React from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Car,
  FileText,
  ImageIcon,
  KeyRound,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Tag,
  User,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { MovementDialog } from '@/components/vehicles/movement-dialog'
import { MovementTimeline } from '@/components/vehicles/movement-timeline'
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePhotoUrls } from '@/hooks/use-photo-urls'
import { useVehicleEvents } from '@/hooks/use-vehicle-events'
import { useVehicle } from '@/hooks/use-vehicles'
import {
  CONDITION_LABEL,
  REGISTRATION_LABEL,
  STATUS_LABEL,
} from '@/lib/constants'
import { formatBytes } from '@/lib/image'
import {
  countBelongings,
  formatDate,
  formatMileage,
  formatNaira,
  telHref,
  vehicleTitle,
} from '@/lib/format'
import { cn } from '@/lib/utils'

function Section({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string
  icon: React.ElementType
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('glass-tile-solid rounded-[1.75rem] p-5 sm:p-6', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Spec({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-sm font-medium', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  )
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: vehicle, isLoading, isError, error, refetch } = useVehicle(id)
  const { data: events = [], isLoading: eventsLoading } = useVehicleEvents(id)
  const { data: photoUrls = {} } = usePhotoUrls(vehicle?.photos)

  const [movementOpen, setMovementOpen] = React.useState(false)
  const [sellOpen, setSellOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  if (isError) {
    return (
      <div className="page-enter space-y-4">
        <BackLink />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }

  if (isLoading || !vehicle) {
    return (
      <div className="page-enter space-y-4">
        <BackLink />
        <Skeleton className="h-40 rounded-[2rem]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[1.75rem] lg:col-span-2" />
          <Skeleton className="h-64 rounded-[1.75rem]" />
        </div>
      </div>
    )
  }

  const inStock = vehicle.status === 'in_stock'
  const sold = vehicle.status === 'sold'
  const owner = vehicle.owner

  return (
    <div className="page-enter space-y-5">
      <BackLink />

      {/* Hero */}
      <header className="glass-hero rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={inStock ? 'inStock' : 'released'}>
                {STATUS_LABEL[vehicle.status]}
              </Badge>
              {vehicle.body_type ? (
                <Badge variant="muted">{vehicle.body_type}</Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-4xl tracking-tight text-display sm:text-5xl">
              {vehicleTitle(vehicle)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {vehicle.plate_number ?? 'No plate recorded'}
              {vehicle.color ? ` · ${vehicle.color}` : ''}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {sold ? 'Sold for' : 'Price'}
              </p>
              <p className="text-2xl font-semibold tracking-tight">
                {formatNaira(sold ? (vehicle.sale_price ?? vehicle.price) : vehicle.price)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              {/* Sold is terminal for movements. Re-recording the sale stays
                  available so a wrong price or buyer can be corrected. */}
              <Button variant={sold ? 'outline' : 'outline'} onClick={() => setSellOpen(true)}>
                <Tag /> {sold ? 'Correct sale' : 'Sold'}
              </Button>
              {!sold ? (
                <Button onClick={() => setMovementOpen(true)}>
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
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {vehicle.photos.length > 0 ? (
            <Section
              title="Pictures"
              icon={ImageIcon}
              action={
                <span className="text-xs text-muted-foreground">
                  {vehicle.photos.length} picture
                  {vehicle.photos.length === 1 ? '' : 's'}
                </span>
              }
            >
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {vehicle.photos.map((photo) => (
                  <li key={photo.path}>
                    <a
                      href={photoUrls[photo.path]}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block overflow-hidden rounded-2xl border border-white/45"
                    >
                      <img
                        src={photoUrls[photo.path]}
                        alt="Vehicle"
                        loading="lazy"
                        className="h-32 w-full bg-white/30 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                      <span className="absolute bottom-1 right-1 rounded-md bg-[hsl(160_20%_18%/.65)] px-1.5 py-0.5 text-[0.6rem] text-white">
                        {formatBytes(photo.bytes)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Vehicle" icon={Car}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Spec label="Car type / Make" value={vehicle.make} />
              <Spec label="Model" value={vehicle.model} />
              <Spec label="Year" value={vehicle.year ?? '—'} />
              <Spec label="Body type" value={vehicle.body_type ?? '—'} />
              <Spec label="Colour" value={vehicle.color ?? '—'} />
              <Spec label="Plate number" value={vehicle.plate_number ?? '—'} />
              <Spec
                label="Condition"
                value={vehicle.condition ? CONDITION_LABEL[vehicle.condition] : '—'}
              />
              <Spec
                label="Mileage"
                value={formatMileage(vehicle.mileage, vehicle.mileage_unit)}
              />
              <Spec
                label="Registration"
                value={vehicle.registration ? REGISTRATION_LABEL[vehicle.registration] : '—'}
              />
              <Spec label="Interior" value={vehicle.interior ?? '—'} />
              <Spec label="VIN" value={vehicle.vin ?? '—'} mono className="col-span-2" />
              <Spec
                label="Keys held"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-muted-foreground" />
                    {vehicle.keys_count}
                  </span>
                }
              />
            </dl>
          </Section>

          <Section
            title="What it arrived with"
            icon={Package}
            action={
              <span className="text-xs text-muted-foreground">
                {countBelongings(vehicle.belongings)} item
                {countBelongings(vehicle.belongings) === 1 ? '' : 's'}
              </span>
            }
          >
            {vehicle.belongings.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/50 px-4 py-5 text-sm text-muted-foreground">
                Nothing was recorded on arrival.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {vehicle.belongings.map((item, index) => (
                  <li
                    key={`${item.item}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.item}</p>
                      {item.note ? (
                        <p className="truncate text-xs text-muted-foreground">{item.note}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full border border-white/50 bg-white/50 px-2.5 py-0.5 text-xs font-medium">
                      ×{item.qty}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Movement history" icon={ArrowUpRight}>
            <MovementTimeline events={events} isLoading={eventsLoading} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Custody" icon={KeyRound}>
            <dl className="space-y-4">
              <Spec label="Intake date" value={formatDate(vehicle.intake_date)} />
              <Spec
                label="Released date"
                value={vehicle.released_date ? formatDate(vehicle.released_date) : 'Still held'}
              />
              {vehicle.sold_date ? (
                <>
                  <Spec label="Sold on" value={formatDate(vehicle.sold_date)} />
                  <Spec label="Sold to" value={vehicle.buyer_name ?? '—'} />
                  <Spec label="Sale price" value={formatNaira(vehicle.sale_price)} />
                </>
              ) : null}
              <Spec label="Record created" value={formatDate(vehicle.created_at)} />
              <Spec label="Last updated" value={formatDate(vehicle.updated_at)} />
            </dl>
          </Section>

          <Section title="Owner" icon={User}>
            {owner ? (
              <div className="space-y-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">{owner.full_name}</p>
                  {owner.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{owner.notes}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <a
                    href={telHref(owner.phone_primary)}
                    className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5 text-sm transition-colors hover:bg-white/50"
                  >
                    <Phone className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{owner.phone_primary}</span>
                  </a>
                  {owner.phone_secondary ? (
                    <a
                      href={telHref(owner.phone_secondary)}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5 text-sm transition-colors hover:bg-white/50"
                    >
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{owner.phone_secondary}</span>
                    </a>
                  ) : null}
                  {owner.email ? (
                    <a
                      href={`mailto:${owner.email}`}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5 text-sm transition-colors hover:bg-white/50"
                    >
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{owner.email}</span>
                    </a>
                  ) : null}
                  {owner.address ? (
                    <p className="flex items-start gap-2.5 rounded-2xl border border-white/40 bg-white/20 px-4 py-2.5 text-sm">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{owner.address}</span>
                    </p>
                  ) : null}
                </div>

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/owners">Manage owners</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={User}
                title="No owner attached"
                description="This vehicle has no owner on record."
                className="px-4 py-8"
              />
            )}
          </Section>

          <Section title="Notes" icon={FileText}>
            {vehicle.notes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{vehicle.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes on this record.</p>
            )}
          </Section>
        </div>
      </div>

      <MovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        vehicle={vehicle}
        eventType={inStock ? 'released' : 'checked_in'}
      />
      <MovementDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        vehicle={vehicle}
        eventType="sold"
      />
      <VehicleFormDialog open={editOpen} onOpenChange={setEditOpen} vehicle={vehicle} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/vehicles"
      className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/50"
    >
      <ArrowLeft className="size-4" />
      All vehicles
    </Link>
  )
}
