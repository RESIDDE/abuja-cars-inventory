import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { vehicleKeys } from '@/hooks/use-vehicles'
import type { VehicleEvent, VehicleEventType } from '@/types/database'

export const eventKeys = {
  forVehicle: (vehicleId: string) => ['vehicle-events', vehicleId] as const,
}

export function useVehicleEvents(vehicleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: eventKeys.forVehicle(vehicleId ?? 'none'),
    enabled: Boolean(vehicleId) && enabled,
    queryFn: async (): Promise<VehicleEvent[]> => {
      const { data, error } = await supabase
        .from('vi_vehicle_events')
        .select('*')
        .eq('vehicle_id', vehicleId as string)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VehicleEvent[]
    },
  })
}

export interface MovementInput {
  vehicleId: string
  eventType: VehicleEventType
  occurredAt: string
  staffName?: string | null
  recipientName?: string | null
  notes?: string | null
}

/**
 * Custody changes go through vi_record_movement, never through a status update
 * plus a separate insert: a failure between those two would change a vehicle's
 * status with nothing in the log to say who moved it.
 */
export function useRecordMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MovementInput): Promise<VehicleEvent> => {
      const { data, error } = await supabase.rpc('vi_record_movement', {
        p_vehicle_id: input.vehicleId,
        p_event_type: input.eventType,
        p_occurred_at: input.occurredAt,
        p_staff_name: input.staffName ?? null,
        p_recipient_name: input.recipientName ?? null,
        p_notes: input.notes ?? null,
      })
      if (error) throw error
      return data as VehicleEvent
    },
    onSuccess: (_event, input) => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.detail(input.vehicleId) })
      void queryClient.invalidateQueries({ queryKey: eventKeys.forVehicle(input.vehicleId) })
    },
  })
}
