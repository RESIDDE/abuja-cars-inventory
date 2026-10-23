import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { describeDbError } from '@/lib/errors'
import { phoneKey } from '@/lib/phone'
import type { PreparedRow } from '@/lib/import/prepare-rows'
import type { Owner } from '@/types/database'

export interface ImportFailure {
  lineNumber: number
  reason: string
}

export interface ImportResult {
  ownersCreated: number
  vehiclesCreated: number
  failures: ImportFailure[]
}

/** Small enough that one bad row doesn't drag many others down with it. */
const CHUNK = 25

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function useImportVehicles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      rows,
      onProgress,
    }: {
      rows: PreparedRow[]
      onProgress?: (done: number, total: number) => void
    }): Promise<ImportResult> => {
      const failures: ImportFailure[] = []

      // --- 1. Owners. One row per phone number, however many vehicles share it.
      const newOwners = new Map<string, { row: PreparedRow; payload: Record<string, unknown> }>()
      for (const row of rows) {
        if (row.owner.existingOwnerId) continue
        const key = phoneKey(row.owner.phone_primary) || row.owner.phone_primary
        if (newOwners.has(key)) continue
        newOwners.set(key, {
          row,
          payload: {
            full_name: row.owner.full_name,
            phone_primary: row.owner.phone_primary,
            phone_secondary: row.owner.phone_secondary,
            email: row.owner.email,
          },
        })
      }

      const ownerIdByPhone = new Map<string, string>()
      if (newOwners.size > 0) {
        const { data, error } = await supabase
          .from('vi_owners')
          .insert([...newOwners.values()].map((o) => o.payload))
          .select('*')
        if (error) throw new Error(describeDbError(error))
        for (const created of (data ?? []) as Owner[]) {
          ownerIdByPhone.set(phoneKey(created.phone_primary) || created.phone_primary, created.id)
        }
      }

      const ownerIdFor = (row: PreparedRow) =>
        row.owner.existingOwnerId ??
        ownerIdByPhone.get(phoneKey(row.owner.phone_primary) || row.owner.phone_primary) ??
        null

      // --- 2. Vehicles, in chunks. A chunk that fails is retried row by row so
      // one bad record is reported rather than losing its twenty-four neighbours.
      const created: { id: string; intake_date: string }[] = []
      let done = 0

      for (const chunk of chunked(rows, CHUNK)) {
        const payload = chunk.flatMap((row) => {
          const owner_id = ownerIdFor(row)
          if (!owner_id) {
            failures.push({ lineNumber: row.lineNumber, reason: 'Could not attach an owner' })
            return []
          }
          return [{ ...row.vehicle, owner_id, status: 'in_stock' }]
        })
        if (payload.length === 0) {
          done += chunk.length
          onProgress?.(done, rows.length)
          continue
        }

        const { data, error } = await supabase
          .from('vi_vehicles')
          .insert(payload)
          .select('id, intake_date')

        if (!error) {
          created.push(...((data ?? []) as { id: string; intake_date: string }[]))
        } else {
          for (const row of chunk) {
            const owner_id = ownerIdFor(row)
            if (!owner_id) continue
            const single = await supabase
              .from('vi_vehicles')
              .insert({ ...row.vehicle, owner_id, status: 'in_stock' })
              .select('id, intake_date')
              .single()
            if (single.error) {
              failures.push({ lineNumber: row.lineNumber, reason: describeDbError(single.error) })
            } else if (single.data) {
              created.push(single.data as { id: string; intake_date: string })
            }
          }
        }

        done += chunk.length
        onProgress?.(done, rows.length)
      }

      // --- 3. Opening events, so an imported vehicle's history is not empty.
      // Inserted directly rather than through vi_record_movement: these rows
      // are created as 'in_stock', so there is no status transition to keep in
      // step, and one round trip per vehicle would be painfully slow on a
      // sheet of a few hundred.
      if (created.length > 0) {
        for (const batch of chunked(created, 100)) {
          const { error } = await supabase.from('vi_vehicle_events').insert(
            batch.map((vehicle) => ({
              vehicle_id: vehicle.id,
              event_type: 'checked_in',
              occurred_at: new Date(`${vehicle.intake_date}T09:00:00`).toISOString(),
              notes: 'Imported from a spreadsheet',
            })),
          )
          if (error) {
            failures.push({
              lineNumber: 0,
              reason: `Vehicles saved, but their opening history entries failed: ${describeDbError(error)}`,
            })
            break
          }
        }
      }

      return {
        ownersCreated: ownerIdByPhone.size,
        vehiclesCreated: created.length,
        failures,
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['owners'] })
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicle-counts'] })
    },
  })
}
