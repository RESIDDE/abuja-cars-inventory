import { bodyTypeFromBodyClass, normalizeVin } from '@/lib/vin'
import type { VinReadResult } from '@/types/vin'

/** The form fields a VIN read can populate. */
export interface VinApplyFields {
  vin: string
  make: string
  model: string
  year: string
  bodyType: string
}

export interface VinApplyPlan {
  /** Only the fields that actually change. */
  updates: Partial<VinApplyFields>
  /** Labels of fields that were empty and are now set. */
  filled: string[]
  /** Labels of fields whose existing value was overwritten. */
  replaced: string[]
}

/**
 * Works out what a reading should change on the form.
 *
 * The photo wins. If a field already holds something different it is
 * overwritten, not preserved — the plate is the source of truth, and a half
 * corrected record is worse than one that simply matches what was read. The
 * caller reports which values were replaced so the change is never silent.
 *
 * A field the reading says nothing about is left exactly as it is: a decoder
 * that returns no model should not wipe a model somebody typed.
 */
export function planVinApply(current: VinApplyFields, read: VinReadResult): VinApplyPlan {
  const updates: Partial<VinApplyFields> = {}
  const filled: string[] = []
  const replaced: string[] = []

  if (!read.readable || !read.vin) return { updates, filled, replaced }

  const put = (
    key: keyof VinApplyFields,
    label: string,
    next: string,
    matches: (existing: string) => boolean,
  ) => {
    const existing = current[key] ?? ''
    if (matches(existing)) return
    updates[key] = next
    if (existing.trim()) replaced.push(label)
    else filled.push(label)
  }

  const sameText = (next: string) => (existing: string) =>
    existing.trim().toLowerCase() === next.toLowerCase()

  put('vin', 'VIN', read.vin, (existing) => normalizeVin(existing) === read.vin)
  if (read.make) put('make', 'make', read.make, sameText(read.make))
  if (read.model) put('model', 'model', read.model, sameText(read.model))
  if (read.year) put('year', 'year', read.year, (existing) => existing.trim() === read.year)

  const bodyType = bodyTypeFromBodyClass(read.bodyClass)
  if (bodyType) put('bodyType', 'body type', bodyType, sameText(bodyType))

  return { updates, filled, replaced }
}
