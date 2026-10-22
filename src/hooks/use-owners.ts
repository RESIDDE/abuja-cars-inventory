import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Owner } from '@/types/database'

export const ownerKeys = {
  all: ['owners'] as const,
  counts: ['owner-vehicle-counts'] as const,
}

export interface OwnerInput {
  full_name: string
  phone_primary: string
  phone_secondary?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

/** Blank strings become null so the columns stay honest about "not recorded". */
export function cleanOwnerInput(input: OwnerInput) {
  const trim = (value: string | null | undefined) => {
    const next = (value ?? '').trim()
    return next === '' ? null : next
  }
  return {
    full_name: input.full_name.trim(),
    phone_primary: input.phone_primary.trim(),
    phone_secondary: trim(input.phone_secondary),
    email: trim(input.email),
    address: trim(input.address),
    notes: trim(input.notes),
  }
}

export function useOwners() {
  return useQuery({
    queryKey: ownerKeys.all,
    queryFn: async (): Promise<Owner[]> => {
      const { data, error } = await supabase
        .from('vi_owners')
        .select('*')
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Owner[]
    },
  })
}

/** How many vehicles each owner has on record, for the owner cards. */
export function useOwnerVehicleCounts() {
  return useQuery({
    queryKey: ownerKeys.counts,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('vi_vehicles').select('owner_id')
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as { owner_id: string }[]) {
        counts[row.owner_id] = (counts[row.owner_id] ?? 0) + 1
      }
      return counts
    },
  })
}

export function useCreateOwner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: OwnerInput): Promise<Owner> => {
      const { data, error } = await supabase
        .from('vi_owners')
        .insert(cleanOwnerInput(input))
        .select('*')
        .single()
      if (error) throw error
      return data as Owner
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.all })
    },
  })
}

export function useUpdateOwner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: OwnerInput & { id: string }): Promise<Owner> => {
      const { data, error } = await supabase
        .from('vi_owners')
        .update(cleanOwnerInput(input))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as Owner
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

/** Deleting an owner cascades to their vehicles — the UI warns about it. */
export function useDeleteOwner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vi_owners').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ownerKeys.counts })
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}
