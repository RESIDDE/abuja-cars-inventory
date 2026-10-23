import * as React from 'react'
import { Plus, Search, ShoppingBag, Users, X } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { OwnerCard } from '@/components/owners/owner-card'
import { OwnerFormDialog } from '@/components/owners/owner-form-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDeleteOwner, useOwnerVehicleCounts, useOwners } from '@/hooks/use-owners'
import { useVehicles } from '@/hooks/use-vehicles'
import { describeDbError } from '@/lib/errors'
import type { Owner } from '@/types/database'

export default function OwnersPage() {
  const { data: owners = [], isLoading, isError, error, refetch } = useOwners()
  const { data: counts = {} } = useOwnerVehicleCounts()
  const { data: vehicles = [] } = useVehicles()
  const deleteOwner = useDeleteOwner()

  const [query, setQuery] = React.useState('')
  const [tab, setTab] = React.useState<'all' | 'storing' | 'buyers'>('all')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Owner | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Owner | null>(null)

  // Buyers are the same customer records, reached through a different
  // relationship, so they are grouped here rather than fetched separately.
  const purchasesByCustomer = React.useMemo(() => {
    const map = new Map<string, typeof vehicles>()
    for (const vehicle of vehicles) {
      if (vehicle.status !== 'sold' || !vehicle.buyer_id) continue
      const list = map.get(vehicle.buyer_id) ?? []
      list.push(vehicle)
      map.set(vehicle.buyer_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.sold_date ?? '').localeCompare(a.sold_date ?? ''))
    }
    return map
  }, [vehicles])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return owners.filter((owner) => {
      if (tab === 'storing' && (counts[owner.id] ?? 0) === 0) return false
      if (tab === 'buyers' && !purchasesByCustomer.has(owner.id)) return false
      if (!needle) return true
      return [owner.full_name, owner.phone_primary, owner.phone_secondary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [owners, query, tab, counts, purchasesByCustomer])

  const buyerCount = purchasesByCustomer.size
  const storingCount = owners.filter((o) => (counts[o.id] ?? 0) > 0).length

  const pendingCount = pendingDelete ? (counts[pendingDelete.id] ?? 0) : 0

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteOwner.mutateAsync(pendingDelete.id)
      toast.success('Owner deleted')
    } catch (err) {
      toast.error(describeDbError(err))
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="page-enter space-y-6">
      <header className="glass-hero rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              People
            </p>
            <h1 className="mt-2 text-4xl tracking-tight text-display sm:text-5xl">Owners</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoading
                ? 'Loading owners…'
                : `${filtered.length} of ${owners.length} owner${owners.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add owner
          </Button>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="all">
              Everyone <span className="ml-1.5 opacity-60">{owners.length}</span>
            </TabsTrigger>
            <TabsTrigger value="storing">
              Storing <span className="ml-1.5 opacity-60">{storingCount}</span>
            </TabsTrigger>
            <TabsTrigger value="buyers">
              Buyers <span className="ml-1.5 opacity-60">{buyerCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or phone number…"
            className="pl-11 pr-11"
            aria-label="Search owners"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === 'buyers' ? ShoppingBag : Users}
          title={
            tab === 'buyers'
              ? 'Nobody has bought a vehicle yet'
              : owners.length === 0
                ? 'No customers yet'
                : 'Nothing matches that'
          }
          description={
            tab === 'buyers'
              ? 'Record a sale from a vehicle card and the buyer will appear here with what they bought.'
              : owners.length === 0
                ? 'Add a customer, or create one straight from the vehicle check-in form.'
                : 'Try a different name or phone number.'
          }
          action={
            owners.length === 0 ? (
              <Button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus /> Add owner
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((owner) => (
            <OwnerCard
              key={owner.id}
              owner={owner}
              vehicleCount={counts[owner.id] ?? 0}
              purchases={purchasesByCustomer.get(owner.id) ?? []}
              onEdit={(o) => {
                setEditing(o)
                setFormOpen(true)
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <OwnerFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        owner={editing}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCount > 0 ? (
                <>
                  This also deletes{' '}
                  <strong className="font-semibold text-foreground">
                    {pendingCount} vehicle record{pendingCount === 1 ? '' : 's'}
                  </strong>{' '}
                  held for them, along with the full movement history of each one. There
                  is no way to undo this.
                </>
              ) : (
                <>
                  They have no vehicles on record. This removes their contact details
                  permanently.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOwner.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteOwner.isPending}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {pendingCount > 0
                ? `Delete owner and ${pendingCount} vehicle${pendingCount === 1 ? '' : 's'}`
                : 'Delete owner'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
