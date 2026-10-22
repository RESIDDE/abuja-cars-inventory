import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { StaffAccount, StaffMember } from '@/types/database'

export const staffKeys = {
  members: ['staff-members'] as const,
  accounts: ['staff-accounts'] as const,
}

export interface StaffMemberInput {
  name: string
  role?: string | null
  phone?: string | null
  active?: boolean
}

function clean(input: StaffMemberInput) {
  const trim = (value: string | null | undefined) => {
    const next = (value ?? '').trim()
    return next === '' ? null : next
  }
  return {
    name: input.name.trim(),
    role: trim(input.role),
    phone: trim(input.phone),
    ...(input.active === undefined ? {} : { active: input.active }),
  }
}

export function useStaffMembers() {
  return useQuery({
    queryKey: staffKeys.members,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from('vi_staff_members')
        .select('*')
        .order('active', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as StaffMember[]
    },
  })
}

/** Who can actually sign in. Read-only here; the list is managed in SQL. */
export function useStaffAccounts() {
  return useQuery({
    queryKey: staffKeys.accounts,
    queryFn: async (): Promise<StaffAccount[]> => {
      const { data, error } = await supabase
        .from('vi_staff')
        .select('user_id, full_name, added_at')
        .order('added_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as StaffAccount[]
    },
  })
}

export function useCreateStaffMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: StaffMemberInput): Promise<StaffMember> => {
      const { data, error } = await supabase
        .from('vi_staff_members')
        .insert(clean(input))
        .select('*')
        .single()
      if (error) throw error
      return data as StaffMember
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: staffKeys.members }),
  })
}

export function useUpdateStaffMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: StaffMemberInput & { id: string }) => {
      const { data, error } = await supabase
        .from('vi_staff_members')
        .update(clean(input))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as StaffMember
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: staffKeys.members }),
  })
}

export function useDeleteStaffMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vi_staff_members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: staffKeys.members }),
  })
}
