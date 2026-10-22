import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus, Users } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/common/field'
import { BelongingsEditor } from '@/components/vehicles/belongings-editor'
import { CurrencyInput } from '@/components/vehicles/currency-input'
import { OwnerMatchHint } from '@/components/owners/owner-match-hint'
import { VehiclePhotoUpload } from '@/components/vehicles/vehicle-photo-upload'
import { VinPhotoCapture } from '@/components/vehicles/vin-photo-capture'
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
import { useCreateOwner, useOwners } from '@/hooks/use-owners'
import { useCreateVehicle, useUpdateVehicle } from '@/hooks/use-vehicles'
import type { OwnerSelection, VehicleInput } from '@/hooks/use-vehicles'
import { BODY_TYPES } from '@/lib/constants'
import { describeDbError } from '@/lib/errors'
import { toDateInputValue } from '@/lib/format'
import { planVinApply } from '@/lib/apply-vin-read'
import { findOwnersByPhone } from '@/lib/phone'
import { checkVin, normalizeVin } from '@/lib/vin'
import { cn } from '@/lib/utils'
import type { PreparedPhoto } from '@/lib/image'
import type { Belonging, VehiclePhoto, VehicleWithOwner } from '@/types/database'
import type { VinReadResult } from '@/types/vin'

const belongingSchema = z.object({
  item: z.string(),
  qty: z.number(),
  note: z.string().nullable().optional(),
})

/**
 * Only the half of the owner section in use gets checked — picking an existing
 * owner must not demand a phone number, and typing a new one must not demand
 * a selection.
 */
const schema = z
  .object({
    ownerMode: z.enum(['existing', 'new']),
    ownerId: z.string(),
    ownerName: z.string(),
    ownerPhone1: z.string(),
    ownerPhone2: z.string(),
    ownerEmail: z.string(),

    make: z.string().trim().min(1, 'Car type / make is required'),
    model: z.string().trim().min(1, 'Model is required'),
    bodyType: z.string(),
    year: z.string(),
    color: z.string(),
    vin: z.string(),
    plate: z.string(),
    keysCount: z.string(),
    price: z.number().nullable(),
    intakeDate: z.string().min(1, 'Intake date is required'),
    belongings: z.array(belongingSchema),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.ownerMode === 'existing') {
      if (!values.ownerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerId'],
          message: 'Choose the owner this vehicle belongs to',
        })
      }
    } else {
      if (!values.ownerName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerName'],
          message: "Owner's name is required",
        })
      }
      if (!values.ownerPhone1.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerPhone1'],
          message: 'A telephone number is required',
        })
      }
      const email = values.ownerEmail.trim()
      if (email && !z.string().email().safeParse(email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerEmail'],
          message: 'That email looks wrong',
        })
      }
    }

    const year = values.year.trim()
    if (year) {
      const parsed = Number(year)
      const limit = new Date().getFullYear() + 1
      if (!Number.isInteger(parsed) || parsed < 1900 || parsed > limit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['year'],
          message: `Enter a year between 1900 and ${limit}`,
        })
      }
    }

    const vin = values.vin.trim()
    if (vin && vin.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vin'],
        message: 'That VIN looks too short',
      })
    }

    const keys = Number(values.keysCount)
    if (!Number.isInteger(keys) || keys < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keysCount'],
        message: 'Keys must be 0 or more',
      })
    }
  })

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    ownerMode: 'existing',
    ownerId: '',
    ownerName: '',
    ownerPhone1: '',
    ownerPhone2: '',
    ownerEmail: '',
    make: '',
    model: '',
    bodyType: '',
    year: '',
    color: '',
    vin: '',
    plate: '',
    keysCount: '1',
    price: null,
    intakeDate: toDateInputValue(new Date()),
    belongings: [],
    notes: '',
  }
}

function valuesFromVehicle(vehicle: VehicleWithOwner): FormValues {
  return {
    ...emptyValues(),
    ownerMode: 'existing',
    ownerId: vehicle.owner_id,
    make: vehicle.make,
    model: vehicle.model,
    bodyType: vehicle.body_type ?? '',
    year: vehicle.year ? String(vehicle.year) : '',
    color: vehicle.color ?? '',
    vin: vehicle.vin ?? '',
    plate: vehicle.plate_number ?? '',
    keysCount: String(vehicle.keys_count ?? 1),
    price: vehicle.price,
    intakeDate: vehicle.intake_date.slice(0, 10),
    belongings: vehicle.belongings,
    notes: vehicle.notes ?? '',
  }
}

interface VehicleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present for an edit, absent for a check-in. */
  vehicle?: VehicleWithOwner | null
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
}: VehicleFormDialogProps) {
  const isEdit = Boolean(vehicle)
  const { data: owners = [], isLoading: ownersLoading } = useOwners()
  const createVehicle = useCreateVehicle()
  const updateVehicle = useUpdateVehicle()
  const createOwner = useCreateOwner()

  const noOwnersYet = !ownersLoading && owners.length === 0

  // Pictures are held as converted blobs and uploaded once the vehicle row
  // exists, so a cancelled form leaves nothing behind in the bucket.
  const [newPhotos, setNewPhotos] = React.useState<PreparedPhoto[]>([])
  const [keptPhotos, setKeptPhotos] = React.useState<VehiclePhoto[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  // Reset on every open so a cancelled check-in doesn't leak into the next one.
  React.useEffect(() => {
    if (!open) return
    form.reset(vehicle ? valuesFromVehicle(vehicle) : emptyValues())
    setNewPhotos([])
    setKeptPhotos(vehicle?.photos ?? [])
  }, [open, vehicle, form])

  // With nobody on record, "Existing" has nothing to offer — start on "New".
  React.useEffect(() => {
    if (!open || isEdit) return
    if (noOwnersYet) form.setValue('ownerMode', 'new')
  }, [open, isEdit, noOwnersYet, form])

  const ownerMode = form.watch('ownerMode')
  const ownerPhone1 = form.watch('ownerPhone1')
  const ownerPhone2 = form.watch('ownerPhone2')
  const vinValue = form.watch('vin')

  // Someone typing a number that is already on record almost always means the
  // owner exists and they did not realise.
  const phoneMatches = React.useMemo(() => {
    if (ownerMode !== 'new') return []
    const found = [
      ...findOwnersByPhone(owners, ownerPhone1),
      ...findOwnersByPhone(owners, ownerPhone2),
    ]
    return found.filter(
      (owner, index) => found.findIndex((other) => other.id === owner.id) === index,
    )
  }, [owners, ownerMode, ownerPhone1, ownerPhone2])

  /** Switch to the existing record rather than creating a duplicate. */
  const useExistingOwner = (ownerId: string) => {
    form.setValue('ownerMode', 'existing')
    form.setValue('ownerId', ownerId, { shouldValidate: true })
    form.clearErrors(['ownerName', 'ownerPhone1', 'ownerEmail'])
    toast.success('Attached to the owner already on record')
  }
  const errors = form.formState.errors

  // Live feedback once there is enough typed to judge, so a mistyped VIN is
  // caught before it reaches the uniqueness index.
  const vinHint = React.useMemo(() => {
    const vin = normalizeVin(vinValue ?? '')
    if (vin.length >= 17 || /[IOQ]/.test(vin)) {
      const problem = checkVin(vin).problem
      if (problem) return problem
      if (vin.length === 17) return 'Check digit matches'
    }
    return 'Optional, but unique when given'
  }, [vinValue])
  const busy =
    form.formState.isSubmitting ||
    createVehicle.isPending ||
    updateVehicle.isPending ||
    createOwner.isPending

  /**
   * Applies what the photo established. The reading wins over anything already
   * typed — the plate is the source of truth — but the toast names whatever it
   * replaced so the change is never silent.
   */
  const applyDecoded = (read: VinReadResult) => {
    const { updates, filled, replaced } = planVinApply(
      {
        vin: form.getValues('vin'),
        make: form.getValues('make'),
        model: form.getValues('model'),
        year: form.getValues('year'),
        bodyType: form.getValues('bodyType'),
      },
      read,
    )

    for (const [field, value] of Object.entries(updates)) {
      form.setValue(field as 'vin' | 'make' | 'model' | 'year' | 'bodyType', value, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }

    const all = [...filled, ...replaced]
    if (all.length === 0) {
      toast.success('The photo matches what is already entered')
      return
    }

    toast.success(`Filled in ${all.join(', ')} from the photo`, {
      description: replaced.length
        ? `Replaced the ${replaced.join(', ')} you had typed.`
        : undefined,
    })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const vehicleInput: VehicleInput = {
      make: values.make,
      model: values.model,
      body_type: values.bodyType || null,
      year: values.year.trim() ? Number(values.year) : null,
      vin: values.vin || null,
      color: values.color || null,
      plate_number: values.plate || null,
      keys_count: Number(values.keysCount),
      belongings: values.belongings as Belonging[],
      price: values.price,
      intake_date: values.intakeDate,
      notes: values.notes || null,
    }

    const newOwner = {
      full_name: values.ownerName,
      phone_primary: values.ownerPhone1,
      phone_secondary: values.ownerPhone2,
      email: values.ownerEmail,
    }

    try {
      if (isEdit && vehicle) {
        const ownerId =
          values.ownerMode === 'new'
            ? (await createOwner.mutateAsync(newOwner)).id
            : values.ownerId
        const kept = new Set(keptPhotos.map((photo) => photo.path))
        await updateVehicle.mutateAsync({
          id: vehicle.id,
          vehicle: vehicleInput,
          ownerId,
          photos: newPhotos,
          keptPhotos,
          removedPhotos: vehicle.photos
            .map((photo) => photo.path)
            .filter((path) => !kept.has(path)),
        })
        toast.success('Vehicle updated')
      } else {
        const ownerSelection: OwnerSelection =
          values.ownerMode === 'new'
            ? { mode: 'new', owner: newOwner }
            : { mode: 'existing', ownerId: values.ownerId }
        const { openingEventError, photoError } = await createVehicle.mutateAsync({
          vehicle: vehicleInput,
          ownerSelection,
          photos: newPhotos,
        })
        if (photoError) {
          toast.warning('Vehicle checked in, but its pictures did not upload', {
            description: describeDbError(photoError),
          })
        }
        if (openingEventError) {
          toast.warning('Vehicle checked in, but its opening history entry failed', {
            description: describeDbError(openingEventError),
          })
        } else {
          toast.success('Vehicle checked in')
        }
      }
      onOpenChange(false)
    } catch (error) {
      const message = describeDbError(error)
      // Put the VIN clash on the field that caused it, not just in a toast.
      if (message.includes('VIN is already on record')) {
        form.setError('vin', { message })
      }
      toast.error(message)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit vehicle' : 'Check in vehicle'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Correct the record for this vehicle.'
              : 'Record what arrived, who owns it and what it came with.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          {/* ---------------- Owner ---------------- */}
          <section className="space-y-3 rounded-2xl border border-white/40 bg-white/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>Owner</Label>
              <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/30 p-1">
                <button
                  type="button"
                  disabled={noOwnersYet}
                  onClick={() => form.setValue('ownerMode', 'existing')}
                  title={noOwnersYet ? 'No owners on record yet' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    ownerMode === 'existing'
                      ? 'pill-nav-active text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                    noOwnersYet && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
                  )}
                >
                  <Users className="size-3.5" /> Existing
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('ownerMode', 'new')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    ownerMode === 'new'
                      ? 'pill-nav-active text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <UserPlus className="size-3.5" /> New
                </button>
              </div>
            </div>

            {ownerMode === 'existing' ? (
              <Field label="Owner on record" error={errors.ownerId?.message}>
                <Controller
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={ownersLoading ? 'Loading owners…' : 'Choose an owner'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.full_name} — {owner.phone_primary}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Owner's name"
                  htmlFor="ownerName"
                  error={errors.ownerName?.message}
                  className="sm:col-span-2"
                >
                  <Input id="ownerName" {...form.register('ownerName')} />
                </Field>
                <Field
                  label="Telephone 1"
                  htmlFor="ownerPhone1"
                  error={errors.ownerPhone1?.message}
                >
                  <Input
                    id="ownerPhone1"
                    inputMode="tel"
                    placeholder="0803 000 0000"
                    {...form.register('ownerPhone1')}
                  />
                </Field>
                <Field label="Telephone 2" htmlFor="ownerPhone2" hint="Optional">
                  <Input id="ownerPhone2" inputMode="tel" {...form.register('ownerPhone2')} />
                </Field>
                <Field
                  label="Email"
                  htmlFor="ownerEmail"
                  error={errors.ownerEmail?.message}
                  hint="Optional"
                  className="sm:col-span-2"
                >
                  <Input id="ownerEmail" type="email" {...form.register('ownerEmail')} />
                </Field>

                {phoneMatches.length > 0 ? (
                  <div className="sm:col-span-2">
                    <OwnerMatchHint
                      matches={phoneMatches}
                      onUse={(owner) => useExistingOwner(owner.id)}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* -------- Photos: the vehicle itself, then the VIN plate -------- */}
          <VehiclePhotoUpload
            value={newPhotos}
            onChange={setNewPhotos}
            existing={keptPhotos}
            onRemoveExisting={(path) =>
              setKeptPhotos((current) => current.filter((photo) => photo.path !== path))
            }
          />

          <VinPhotoCapture onDecoded={applyDecoded} />

          {/* ---------------- Vehicle ---------------- */}
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Car type / Make" htmlFor="make" error={errors.make?.message}>
              <Input id="make" placeholder="Toyota" {...form.register('make')} />
            </Field>
            <Field label="Model" htmlFor="model" error={errors.model?.message}>
              <Input id="model" placeholder="Corolla" {...form.register('model')} />
            </Field>

            <Field label="Body type" error={errors.bodyType?.message}>
              <Controller
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a body type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Year" htmlFor="year" error={errors.year?.message}>
              <Input
                id="year"
                inputMode="numeric"
                placeholder="2016"
                {...form.register('year')}
              />
            </Field>

            <Field label="Colour" htmlFor="color">
              <Input id="color" placeholder="Silver" {...form.register('color')} />
            </Field>
            <Field label="Plate number" htmlFor="plate">
              <Input id="plate" placeholder="ABC 123 XY" {...form.register('plate')} />
            </Field>

            <Field
              label="VIN"
              htmlFor="vin"
              error={errors.vin?.message}
              hint={vinHint}
              className="sm:col-span-2"
            >
              <Input
                id="vin"
                className="font-mono uppercase"
                placeholder="JTDBR32E030123456"
                {...form.register('vin')}
              />
            </Field>

            <Field label="Number of keys" htmlFor="keysCount" error={errors.keysCount?.message}>
              <Input id="keysCount" type="number" min={0} {...form.register('keysCount')} />
            </Field>
            <Field label="Price (NGN)" error={errors.price?.message} hint="Optional">
              <Controller
                control={form.control}
                name="price"
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                  />
                )}
              />
            </Field>

            <Field
              label="Intake date"
              htmlFor="intakeDate"
              error={errors.intakeDate?.message}
              className="sm:col-span-2"
            >
              <Input id="intakeDate" type="date" {...form.register('intakeDate')} />
            </Field>
          </section>

          {/* ---------------- Belongings ---------------- */}
          <section className="space-y-2">
            <Label>What it arrived with</Label>
            <Controller
              control={form.control}
              name="belongings"
              render={({ field }) => (
                <BelongingsEditor
                  value={field.value as Belonging[]}
                  onChange={field.onChange}
                />
              )}
            />
          </section>

          <Field label="Notes" htmlFor="notes" hint="Optional">
            <Textarea
              id="notes"
              rows={3}
              placeholder="Dent on the rear bumper, fuel at a quarter tank…"
              {...form.register('notes')}
            />
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
              {isEdit ? 'Save changes' : 'Check in vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
