import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { normalizeVehicle } from '@/lib/normalize'
import { cleanOwnerInput } from '@/hooks/use-owners'
import {
  discardVehiclePhotos,
  removeVehiclePhotos,
  uploadVehiclePhotos,
} from '@/lib/storage'
import type { PreparedPhoto } from '@/lib/image'
import type { OwnerInput } from '@/hooks/use-owners'
import type { Belonging, Owner, VehiclePhoto, VehicleWithOwner } from '@/types/database'

export const vehicleKeys = {
  all: ['vehicles'] as const,
  detail: (id: string) => ['vehicle', id] as const,
}

// Both owner_id and buyer_id point at vi_owners, so the embed MUST name which
// foreign key it means — PostgREST refuses to guess and returns a 300.
const SELECT_WITH_OWNER =
  '*, owner:vi_owners!owner_id(*), buyer:vi_owners!buyer_id(*)'

export interface VehicleInput {
  make: string
  model: string
  body_type?: string | null
  year?: number | null
  vin?: string | null
  color?: string | null
  plate_number?: string | null
  keys_count: number
  condition?: string | null
  mileage?: number | null
  mileage_unit?: string
  registration?: string | null
  interior?: string | null
  belongings: Belonging[]
  price?: number | null
  intake_date: string
  notes?: string | null
}

/** Either attach to an existing owner, or create one and attach to that. */
export type OwnerSelection =
  | { mode: 'existing'; ownerId: string }
  | { mode: 'new'; owner: OwnerInput }

function cleanVehicleInput(input: VehicleInput) {
  const trim = (value: string | null | undefined) => {
    const next = (value ?? '').trim()
    return next === '' ? null : next
  }
  return {
    make: input.make.trim(),
    model: input.model.trim(),
    body_type: trim(input.body_type),
    year: input.year ?? null,
    // Stored upper-case: the unique index is on upper(vin), so this keeps what
    // is on screen matching what the database compares.
    vin: trim(input.vin)?.toUpperCase() ?? null,
    color: trim(input.color),
    plate_number: trim(input.plate_number)?.toUpperCase() ?? null,
    keys_count: Number.isFinite(input.keys_count) ? Math.max(0, input.keys_count) : 1,
    condition: trim(input.condition),
    mileage:
      input.mileage === null || input.mileage === undefined
        ? null
        : Math.max(0, Math.round(input.mileage)),
    mileage_unit: input.mileage_unit === 'mi' ? 'mi' : 'km',
    registration: trim(input.registration),
    interior: trim(input.interior),
    belongings: input.belongings.map((b) => ({
      item: b.item.trim(),
      qty: b.qty,
      note: (b.note ?? '').trim() || '',
    })),
    price: input.price ?? null,
    intake_date: input.intake_date,
    notes: trim(input.notes),
  }
}

/**
 * The opening 'checked_in' event is timestamped on the intake date, at 9am
 * when that date is in the past, so a back-dated intake doesn't claim it
 * arrived at the moment somebody typed it in.
 */
function intakeTimestamp(intakeDate: string) {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (intakeDate >= todayKey) return today.toISOString()
  return new Date(`${intakeDate}T09:00:00`).toISOString()
}

export function useVehicles() {
  return useQuery({
    queryKey: vehicleKeys.all,
    queryFn: async (): Promise<VehicleWithOwner[]> => {
      const { data, error } = await supabase
        .from('vi_vehicles')
        .select(SELECT_WITH_OWNER)
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as Record<string, unknown>[]).map(normalizeVehicle)
    },
  })
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: vehicleKeys.detail(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: async (): Promise<VehicleWithOwner> => {
      const { data, error } = await supabase
        .from('vi_vehicles')
        .select(SELECT_WITH_OWNER)
        .eq('id', id as string)
        .single()
      if (error) throw error
      return normalizeVehicle(data as Record<string, unknown>)
    },
  })
}

export interface CreateVehicleResult {
  vehicle: VehicleWithOwner
  /** Set when the vehicle saved but its pictures did not. */
  photoError?: unknown | null
  /**
   * The vehicle saved, but its opening history entry did not. The caller says
   * so rather than reporting the whole check-in as failed, which would invite
   * a second submit and a duplicate record.
   */
  openingEventError: unknown | null
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vehicle,
      ownerSelection,
      photos = [],
    }: {
      vehicle: VehicleInput
      ownerSelection: OwnerSelection
      photos?: PreparedPhoto[]
    }): Promise<CreateVehicleResult> => {
      let ownerId: string
      let createdOwnerId: string | null = null

      if (ownerSelection.mode === 'new') {
        // The owner is created first and the vehicle attached to it, so nobody
        // has to leave the form to add a person who isn't on record yet.
        const { data, error } = await supabase
          .from('vi_owners')
          .insert(cleanOwnerInput(ownerSelection.owner))
          .select('*')
          .single()
        if (error) throw error
        ownerId = (data as Owner).id
        createdOwnerId = ownerId
      } else {
        ownerId = ownerSelection.ownerId
      }

      const { data: inserted, error: vehicleError } = await supabase
        .from('vi_vehicles')
        .insert({ ...cleanVehicleInput(vehicle), owner_id: ownerId, status: 'in_stock' })
        .select(SELECT_WITH_OWNER)
        .single()

      if (vehicleError) {
        // A VIN clash here would otherwise leave an owner behind that the user
        // never meant to create on their own.
        if (createdOwnerId) {
          await supabase.from('vi_owners').delete().eq('id', createdOwnerId)
        }
        throw vehicleError
      }

      let vehicleRow = normalizeVehicle(inserted as Record<string, unknown>)

      // Pictures go up only now that the row exists, so a cancelled form never
      // leaves orphans in the bucket. A failure here does not undo the
      // check-in: the record is more important than the photographs.
      let photoError: unknown = null
      if (photos.length > 0) {
        let stored: VehiclePhoto[] = []
        try {
          stored = await uploadVehiclePhotos(vehicleRow.id, photos)
          const { data: withPhotos, error } = await supabase
            .from('vi_vehicles')
            .update({ photos: stored })
            .eq('id', vehicleRow.id)
            .select(SELECT_WITH_OWNER)
            .single()
          if (error) throw error
          vehicleRow = normalizeVehicle(withPhotos as Record<string, unknown>)
        } catch (error) {
          await discardVehiclePhotos(stored.map((photo) => photo.path))
          photoError = error
        }
      }

      // The opening event, so a vehicle's history is never empty. It goes
      // through the same function every other movement does.
      const { error: eventError } = await supabase.rpc('vi_record_movement', {
        p_vehicle_id: vehicleRow.id,
        p_event_type: 'checked_in',
        p_occurred_at: intakeTimestamp(vehicleRow.intake_date),
        p_staff_name: null,
        p_recipient_name: null,
        p_notes: 'Checked in to the yard',
      })

      // The vehicle is already saved at this point, so this is reported back
      // instead of thrown: re-submitting would create a second record.
      return { vehicle: vehicleRow, openingEventError: eventError ?? null, photoError }
    },
    onSuccess: ({ vehicle }) => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owners'] })
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicle-counts'] })
      void queryClient.invalidateQueries({ queryKey: ['vehicle-events', vehicle.id] })
    },
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      vehicle,
      ownerId,
      photos = [],
      keptPhotos = [],
      removedPhotos = [],
    }: {
      id: string
      vehicle: VehicleInput
      ownerId: string
      photos?: PreparedPhoto[]
      keptPhotos?: VehiclePhoto[]
      removedPhotos?: string[]
    }): Promise<VehicleWithOwner> => {
      const uploaded = photos.length > 0 ? await uploadVehiclePhotos(id, photos) : []

      const { data, error } = await supabase
        .from('vi_vehicles')
        .update({
          ...cleanVehicleInput(vehicle),
          owner_id: ownerId,
          photos: [...keptPhotos, ...uploaded],
        })
        .eq('id', id)
        .select(SELECT_WITH_OWNER)
        .maybeSingle()

      if (error || !data) {
        await discardVehiclePhotos(uploaded.map((photo) => photo.path))
        throw error ?? new Error('That vehicle no longer exists. It may have been deleted.')
      }

      // Only once the row no longer references them.
      if (removedPhotos.length > 0) {
        try {
          await removeVehiclePhotos(removedPhotos)
        } catch {
          // Leaving a stale object behind is better than failing a saved edit.
        }
      }

      return normalizeVehicle(data as Record<string, unknown>)
    },
    onSuccess: (vehicle) => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.detail(vehicle.id) })
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicle-counts'] })
    },
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vi_vehicles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicle-counts'] })
    },
  })
}
