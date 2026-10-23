import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/common/field'
import { NumberStepper } from '@/components/common/number-stepper'
import { SignaturePad } from '@/components/common/signature-pad'
import type { SignaturePadHandle } from '@/components/common/signature-pad'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useStaffMembers } from '@/hooks/use-staff-members'
import { useRecordMovement, useVehicleEvents } from '@/hooks/use-vehicle-events'
import { describeDbError } from '@/lib/errors'
import { uploadSignature } from '@/lib/storage'
import { CurrencyInput } from '@/components/vehicles/currency-input'
import { formatDate, toDateTimeInputValue, vehicleTitle } from '@/lib/format'
import type { VehicleEventType, VehicleWithOwner } from '@/types/database'

const schema = z.object({
  occurredAt: z.string().min(1, 'Date and time are required'),
  staffName: z.string(),
  recipientName: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

/** Sentinel for the "not on the list" option; never stored. */
const OTHER = '__other__'

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
  const selling = eventType === 'sold'
  // A sale also takes the vehicle out of the yard, so it shares the release
  // side of every label and default.
  const releasing = eventType === 'released' || selling

  // How many keys the yard currently holds, and what went out last time.
  const heldKeys = vehicle?.keys_count ?? 0
  const { data: events = [] } = useVehicleEvents(vehicle?.id, open)
  const lastRelease = React.useMemo(
    () => events.find((e) => e.event_type === 'released' && e.keys_count !== null) ?? null,
    [events],
  )

  const [keys, setKeys] = React.useState(0)

  // Names come from Settings. "Someone else" stays available so a one-off
  // cover shift is never a reason to leave the field blank.
  const { data: staffMembers = [] } = useStaffMembers()
  const activeStaff = React.useMemo(
    () => staffMembers.filter((member) => member.active),
    [staffMembers],
  )
  const [staffOther, setStaffOther] = React.useState(false)
  const [salePrice, setSalePrice] = React.useState<number | null>(null)

  const signature = React.useRef<SignaturePadHandle>(null)
  const [signed, setSigned] = React.useState(false)

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
    // Releasing normally hands over everything the yard holds; checking back in
    // normally returns however many went out.
    setKeys(releasing ? heldKeys : (lastRelease?.keys_count ?? heldKeys))
    setStaffOther(false)
    signature.current?.clear()
    setSigned(false)
    setSalePrice(vehicle?.sale_price ?? vehicle?.price ?? null)
  }, [open, form, releasing, heldKeys, lastRelease, vehicle])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!vehicle) return
    try {
      // Uploaded before the movement is recorded, so the path can go into the
      // same transaction as the custody change rather than being bolted on
      // afterwards.
      let signaturePath: string | null = null
      const blob = await signature.current?.toBlob()
      if (blob) signaturePath = await uploadSignature(vehicle.id, blob)

      await recordMovement.mutateAsync({
        vehicleId: vehicle.id,
        eventType,
        // datetime-local has no zone; the browser's own zone is the right one.
        occurredAt: new Date(values.occurredAt).toISOString(),
        staffName: values.staffName,
        recipientName: values.recipientName,
        notes: values.notes,
        keysCount: keys,
        signaturePath,
        salePrice: selling ? salePrice : null,
      })
      toast.success(
        selling ? 'Sale recorded' : releasing ? 'Vehicle released' : 'Vehicle checked back in',
      )
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
          <DialogTitle>
            {selling ? 'Record a sale' : releasing ? 'Release vehicle' : 'Check back in'}
          </DialogTitle>
          <DialogDescription>
            {vehicle ? vehicleTitle(vehicle) : ''}
            {vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {selling ? (
            <Field label="Sale price (NGN)" hint="Defaults to the price on the record">
              <CurrencyInput value={salePrice} onChange={setSalePrice} placeholder="0" />
            </Field>
          ) : null}

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

          <div className="space-y-1.5">
            <Label>{releasing ? 'Keys released' : 'Keys brought back'}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <NumberStepper
                value={keys}
                onChange={setKeys}
                max={releasing ? Math.max(heldKeys, 1) : 99}
                label={releasing ? 'keys released' : 'keys brought back'}
              />
              <p className="text-xs text-muted-foreground">
                {releasing
                  ? `${heldKeys} held on this vehicle`
                  : lastRelease
                    ? `${lastRelease.keys_count} released on ${formatDate(lastRelease.occurred_at)}`
                    : 'Nothing recorded as released'}
              </p>
            </div>

            {!releasing && lastRelease && keys < (lastRelease.keys_count ?? 0) ? (
              <p className="text-xs text-destructive">
                That is {(lastRelease.keys_count ?? 0) - keys} fewer than went out. Worth a
                note below.
              </p>
            ) : null}
          </div>

          <Field
            label="Handled by"
            htmlFor="staffName"
            hint={
              activeStaff.length === 0
                ? 'Optional — add staff in Settings to pick from a list'
                : 'Optional'
            }
          >
            {activeStaff.length > 0 && !staffOther ? (
              <Controller
                control={form.control}
                name="staffName"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      if (value === OTHER) {
                        setStaffOther(true)
                        field.onChange('')
                      } else {
                        field.onChange(value)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose who handled it" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStaff.map((member) => (
                        <SelectItem key={member.id} value={member.name}>
                          {member.name}
                          {member.role ? ` — ${member.role}` : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Someone else…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input id="staffName" placeholder="Type a name" {...form.register('staffName')} />
                {activeStaff.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStaffOther(false)
                      form.setValue('staffName', '')
                    }}
                  >
                    Pick from list
                  </Button>
                ) : null}
              </div>
            )}
          </Field>

          <Field
            label={selling ? 'Sold to' : releasing ? 'Released to' : 'Received from'}
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

          <div className="space-y-1.5">
            <Label>
              {selling
                ? 'Signature — buyer'
                : releasing
                  ? 'Signature — person taking the vehicle'
                  : 'Signature — person returning it'}
            </Label>
            <SignaturePad
              ref={signature}
              onChange={setSigned}
              hint={
                form.watch('recipientName')?.trim() ||
                vehicle?.owner?.full_name ||
                'Sign here'
              }
            />
            {releasing && !signed ? (
              <p className="text-xs text-muted-foreground">
                Optional, but a signature is the thing that settles a dispute later.
              </p>
            ) : null}
          </div>

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
              {selling ? 'Record sale' : releasing ? 'Record release' : 'Record check-in'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
