import * as React from 'react'
import { UserPlus, Users } from 'lucide-react'

import { Field } from '@/components/common/field'
import { OwnerMatchHint } from '@/components/owners/owner-match-hint'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { findOwnersByPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { Owner } from '@/types/database'

export interface CustomerDraft {
  mode: 'existing' | 'new'
  customerId: string
  name: string
  phone: string
  phone2: string
  email: string
}

export const emptyCustomer = (): CustomerDraft => ({
  mode: 'existing',
  customerId: '',
  name: '',
  phone: '',
  phone2: '',
  email: '',
})

/** What is missing before this draft can be saved. */
export function customerProblems(draft: CustomerDraft, required: boolean): string[] {
  if (draft.mode === 'existing') {
    return required && !draft.customerId ? ['Choose who it was sold to'] : []
  }
  const problems: string[] = []
  if (!draft.name.trim()) problems.push("The buyer's name is needed")
  if (!draft.phone.trim()) problems.push('A telephone number is needed')
  return problems
}

interface CustomerPickerProps {
  label: string
  customers: Owner[]
  value: CustomerDraft
  onChange: (next: CustomerDraft) => void
  /** Shown when nothing is chosen yet and the field may be left blank. */
  optionalHint?: string
}

/**
 * Picks an existing customer or captures a new one, matching on phone number
 * so the same person is not entered twice — a buyer may already be on record
 * as somebody whose car you are storing.
 */
export function CustomerPicker({
  label,
  customers,
  value,
  onChange,
  optionalHint,
}: CustomerPickerProps) {
  const set = (patch: Partial<CustomerDraft>) => onChange({ ...value, ...patch })
  const nobodyOnRecord = customers.length === 0

  React.useEffect(() => {
    if (nobodyOnRecord && value.mode === 'existing') set({ mode: 'new' })
    // Only when the roster itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nobodyOnRecord])

  const matches = React.useMemo(() => {
    if (value.mode !== 'new') return []
    return [
      ...findOwnersByPhone(customers, value.phone),
      ...findOwnersByPhone(customers, value.phone2),
    ].filter((owner, i, all) => all.findIndex((o) => o.id === owner.id) === i)
  }, [customers, value.mode, value.phone, value.phone2])

  return (
    <section className="space-y-3 rounded-2xl border border-white/40 bg-white/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label>{label}</Label>
        <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/30 p-1">
          <button
            type="button"
            disabled={nobodyOnRecord}
            onClick={() => set({ mode: 'existing' })}
            title={nobodyOnRecord ? 'Nobody on record yet' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              value.mode === 'existing'
                ? 'pill-nav-active text-foreground'
                : 'text-muted-foreground hover:text-foreground',
              nobodyOnRecord && 'cursor-not-allowed opacity-50',
            )}
          >
            <Users className="size-3.5" /> Existing
          </button>
          <button
            type="button"
            onClick={() => set({ mode: 'new' })}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              value.mode === 'new'
                ? 'pill-nav-active text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <UserPlus className="size-3.5" /> New
          </button>
        </div>
      </div>

      {value.mode === 'existing' ? (
        <Field label="Customer on record" hint={optionalHint}>
          <Select
            value={value.customerId || undefined}
            onValueChange={(id) => set({ customerId: id })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.full_name} — {customer.phone_primary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input
              value={value.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Chidi Obi"
            />
          </Field>
          <Field label="Telephone 1">
            <Input
              inputMode="tel"
              value={value.phone}
              onChange={(event) => set({ phone: event.target.value })}
              placeholder="0803 000 0000"
            />
          </Field>
          <Field label="Telephone 2" hint="Optional">
            <Input
              inputMode="tel"
              value={value.phone2}
              onChange={(event) => set({ phone2: event.target.value })}
            />
          </Field>
          <Field label="Email" hint="Optional" className="sm:col-span-2">
            <Input
              type="email"
              value={value.email}
              onChange={(event) => set({ email: event.target.value })}
            />
          </Field>

          {matches.length > 0 ? (
            <div className="sm:col-span-2">
              <OwnerMatchHint
                matches={matches}
                onUse={(owner) => set({ mode: 'existing', customerId: owner.id })}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
