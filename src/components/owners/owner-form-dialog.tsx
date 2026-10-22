import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/common/field'
import { OwnerMatchHint } from '@/components/owners/owner-match-hint'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateOwner, useOwners, useUpdateOwner } from '@/hooks/use-owners'
import { describeDbError } from '@/lib/errors'
import { findOwnersByPhone } from '@/lib/phone'
import type { Owner } from '@/types/database'

const schema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  phone_primary: z.string().trim().min(1, 'A telephone number is required'),
  phone_secondary: z.string(),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'That email looks wrong',
    }),
  address: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  full_name: '',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  address: '',
  notes: '',
}

interface OwnerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  owner?: Owner | null
}

export function OwnerFormDialog({ open, onOpenChange, owner }: OwnerFormDialogProps) {
  const isEdit = Boolean(owner)
  const { data: owners = [] } = useOwners()
  const createOwner = useCreateOwner()
  const updateOwner = useUpdateOwner()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  React.useEffect(() => {
    if (!open) return
    form.reset(
      owner
        ? {
            full_name: owner.full_name,
            phone_primary: owner.phone_primary,
            phone_secondary: owner.phone_secondary ?? '',
            email: owner.email ?? '',
            address: owner.address ?? '',
            notes: owner.notes ?? '',
          }
        : EMPTY,
    )
  }, [open, owner, form])

  const errors = form.formState.errors
  const busy = form.formState.isSubmitting || createOwner.isPending || updateOwner.isPending

  // Warn about a duplicate as the number is typed. There is nothing to switch
  // to here — this dialog only makes owners — so it informs rather than acts,
  // and excludes the record being edited so it never flags itself.
  const phone1 = form.watch('phone_primary')
  const phone2 = form.watch('phone_secondary')
  const phoneMatches = React.useMemo(() => {
    const found = [
      ...findOwnersByPhone(owners, phone1, owner?.id),
      ...findOwnersByPhone(owners, phone2, owner?.id),
    ]
    return found.filter(
      (match, index) => found.findIndex((other) => other.id === match.id) === index,
    )
  }, [owners, phone1, phone2, owner?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && owner) {
        await updateOwner.mutateAsync({ id: owner.id, ...values })
        toast.success('Owner updated')
      } else {
        await createOwner.mutateAsync(values)
        toast.success('Owner added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(describeDbError(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit owner' : 'Add owner'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Keep their contact details current.'
              : 'Record the person whose vehicles you hold.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
            <Input id="full_name" {...form.register('full_name')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Telephone 1"
              htmlFor="phone_primary"
              error={errors.phone_primary?.message}
            >
              <Input
                id="phone_primary"
                inputMode="tel"
                placeholder="0803 000 0000"
                {...form.register('phone_primary')}
              />
            </Field>
            <Field label="Telephone 2" htmlFor="phone_secondary" hint="Optional">
              <Input
                id="phone_secondary"
                inputMode="tel"
                {...form.register('phone_secondary')}
              />
            </Field>
          </div>

          {phoneMatches.length > 0 ? <OwnerMatchHint matches={phoneMatches} /> : null}

          <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Optional">
            <Input id="email" type="email" {...form.register('email')} />
          </Field>

          <Field label="Address" htmlFor="address" hint="Optional">
            <Textarea id="address" rows={2} {...form.register('address')} />
          </Field>

          <Field label="Notes" htmlFor="ownerNotes" hint="Optional">
            <Textarea id="ownerNotes" rows={2} {...form.register('notes')} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Add owner'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
