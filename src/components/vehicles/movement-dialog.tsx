import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/common/field'
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
import { useRecordMovement } from '@/hooks/use-vehicle-events'
import { describeDbError } from '@/lib/errors'
import { toDateTimeInputValue, vehicleTitle } from '@/lib/format'
import type { VehicleEventType, VehicleWithOwner } from '@/types/database'

const schema = z.object({
  occurredAt: z.string().min(1, 'Date and time are required'),
  staffName: z.string(),
  recipientName: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

interface MovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: VehicleWithOwner | null
  eventType: VehicleEventType
}

export function MovementDialog({
  open,
  onOpenChange,
  vehicle,
  eventType,
}: MovementDialogProps) {
  const recordMovement = useRecordMovement()
  const releasing = eventType === 'released'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      occurredAt: toDateTimeInputValue(new Date()),
      staffName: '',
      recipientName: '',
      notes: '',
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      occurredAt: toDateTimeInputValue(new Date()),
      staffName: '',
      recipientName: '',
      notes: '',
    })
  }, [open, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!vehicle) return
    try {
      await recordMovement.mutateAsync({
        vehicleId: vehicle.id,
        eventType,
        // datetime-local has no zone; the browser's own zone is the right one.
        occurredAt: new Date(values.occurredAt).toISOString(),
        staffName: values.staffName,
        recipientName: values.recipientName,
        notes: values.notes,
      })
      toast.success(releasing ? 'Vehicle released' : 'Vehicle checked back in')
      onOpenChange(false)
    } catch (error) {
      toast.error(describeDbError(error))
    }
  })

  const busy = form.formState.isSubmitting || recordMovement.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{releasing ? 'Release vehicle' : 'Check back in'}</DialogTitle>
          <DialogDescription>
            {vehicle ? vehicleTitle(vehicle) : ''}
            {vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="Date & time"
            htmlFor="occurredAt"
            error={form.formState.errors.occurredAt?.message}
          >
            <Input
              id="occurredAt"
              type="datetime-local"
              {...form.register('occurredAt')}
            />
          </Field>

          <Field label="Staff name" htmlFor="staffName" hint="Optional — who handled it">
            <Input id="staffName" {...form.register('staffName')} />
          </Field>

          <Field
            label={releasing ? 'Released to' : 'Received from'}
            htmlFor="recipientName"
            hint="Optional"
          >
            <Input
              id="recipientName"
              placeholder={vehicle?.owner?.full_name ?? ''}
              {...form.register('recipientName')}
            />
          </Field>

          <Field label="Notes" htmlFor="movementNotes" hint="Optional">
            <Textarea id="movementNotes" rows={3} {...form.register('notes')} />
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
              {releasing ? 'Record release' : 'Record check-in'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
