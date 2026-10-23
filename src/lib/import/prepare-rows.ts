import { BODY_TYPES } from '@/lib/constants'
import { phoneKey } from '@/lib/phone'
import { checkVin, normalizeVin } from '@/lib/vin'
import type { ImportFieldKey } from '@/lib/import/fields'
import type { Owner } from '@/types/database'

export interface PreparedRow {
  /** 1-based row number as the person sees it in their sheet. */
  lineNumber: number
  values: Partial<Record<ImportFieldKey, string>>
  /** Blocking problems — the row will not be imported. */
  errors: string[]
  /** Worth knowing, but the row still imports. */
  warnings: string[]
  owner: {
    full_name: string
    phone_primary: string
    phone_secondary: string | null
    email: string | null
    /** Set when this phone already belongs to somebody on record. */
    existingOwnerId: string | null
  }
  vehicle: {
    make: string
    model: string
    body_type: string | null
    year: number | null
    vin: string | null
    color: string | null
    plate_number: string | null
    keys_count: number
    price: number | null
    intake_date: string
    notes: string | null
  }
}

const cell = (row: string[], index: number | undefined) =>
  index === undefined ? '' : (row[index] ?? '').toString().trim()

/** Accepts 2016, "2016.0" (Excel's doing) and rejects anything else. */
function parseYear(raw: string): { value: number | null; error?: string } {
  if (!raw) return { value: null }
  const n = Number(raw.replace(/\.0+$/, ''))
  const limit = new Date().getFullYear() + 1
  if (!Number.isInteger(n) || n < 1900 || n > limit) {
    return { value: null, error: `Year "${raw}" is not between 1900 and ${limit}` }
  }
  return { value: n }
}

/** Strips ₦, NGN, commas and spaces. "₦12,500,000" and "12500000.00" both work. */
function parsePrice(raw: string): { value: number | null; error?: string } {
  if (!raw) return { value: null }
  const cleaned = raw.replace(/[₦$£€]|ngn/gi, '').replace(/[,\s]/g, '')
  if (!cleaned) return { value: null }
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return { value: null, error: `Price "${raw}" is not a number` }
  return { value: Math.round(n) }
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Dates arrive in whatever the sheet had. Handles ISO, d/m/y and m/d/y, and
 * Excel's serial numbers. Day-first is assumed when ambiguous, which is the
 * Nigerian convention.
 */
export function parseSheetDate(raw: string, today = new Date()): { value: string; warning?: string } {
  const fallback = toIso(today)
  if (!raw) return { value: fallback }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return { value: `${y}-${pad(Number(m))}-${pad(Number(d))}` }
  }

  const slash = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (slash) {
    let [, a, b, y] = slash
    let day = Number(a)
    let month = Number(b)
    let warning: string | undefined
    if (day > 12 && month <= 12) {
      // unambiguous, day-first
    } else if (month > 12 && day <= 12) {
      ;[day, month] = [month, day]
    } else if (day <= 12 && month <= 12) {
      warning = `Read "${raw}" as ${day}/${month} (day first)`
    }
    const year = Number(y.length === 2 ? `20${y}` : y)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { value: `${year}-${pad(month)}-${pad(day)}`, warning }
    }
  }

  // Excel keeps dates as days since 1899-12-30.
  const serial = Number(raw)
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    return { value: toIso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return { value: toIso(parsed) }

  return { value: fallback, warning: `Could not read the date "${raw}"; used today` }
}

/**
 * What people actually write in a body-type column here. "Saloon" is the
 * everyday word for a sedan, and "Jeep" means an SUV regardless of who made
 * it — in a body-type column that is a shape, not a manufacturer.
 */
const BODY_SYNONYMS: Record<string, string> = {
  saloon: 'Sedan',
  sedan: 'Sedan',
  jeep: 'SUV',
  suv: 'SUV',
  crossover: 'SUV',
  '4x4': 'SUV',
  '4wd': 'SUV',
  hatch: 'Hatchback',
  hatchback: 'Hatchback',
  pickup: 'Pickup',
  'pick up': 'Pickup',
  'pick-up': 'Pickup',
  truck: 'Truck',
  lorry: 'Truck',
  trailer: 'Truck',
  bus: 'Bus',
  minibus: 'Bus',
  'mini bus': 'Bus',
  coaster: 'Bus',
  van: 'Van',
  minivan: 'Van',
  'mini van': 'Van',
  coupe: 'Coupe',
  convertible: 'Coupe',
  wagon: 'Wagon',
  estate: 'Wagon',
  'station wagon': 'Wagon',
}

function matchBodyType(raw: string): { value: string | null; warning?: string } {
  if (!raw) return { value: null }
  const key = raw.toLowerCase().trim().replace(/\s+/g, ' ')

  const synonym = BODY_SYNONYMS[key]
  if (synonym) return { value: synonym }

  const exact = BODY_TYPES.find((t) => t.toLowerCase() === key)
  if (exact) return { value: exact }

  const loose = BODY_TYPES.find((t) => t.toLowerCase().includes(key) || key.includes(t.toLowerCase()))
  if (loose) return { value: loose }

  const partial = Object.keys(BODY_SYNONYMS).find((k) => key.includes(k))
  if (partial) return { value: BODY_SYNONYMS[partial] }

  return { value: 'Other', warning: `Body type "${raw}" is not one of ours; used "Other"` }
}

export interface PrepareOptions {
  rows: string[][]
  mapping: Partial<Record<ImportFieldKey, number>>
  existingOwners: Owner[]
  /** Upper-cased VINs already in the database. */
  existingVins: Set<string>
  today?: Date
}

/**
 * Turns raw sheet rows into records ready to insert, with every problem
 * attached to the row it came from. Pure, so the whole thing is testable
 * without a database or a browser.
 */
export function prepareRows({
  rows,
  mapping,
  existingOwners,
  existingVins,
  today = new Date(),
}: PrepareOptions): PreparedRow[] {
  const seenVins = new Map<string, number>()
  const prepared: PreparedRow[] = []

  rows.forEach((row, i) => {
    const lineNumber = i + 2 // +1 for the header, +1 for 1-based counting
    const errors: string[] = []
    const warnings: string[] = []
    const get = (key: ImportFieldKey) => cell(row, mapping[key])

    const values: Partial<Record<ImportFieldKey, string>> = {}
    for (const key of Object.keys(mapping) as ImportFieldKey[]) values[key] = get(key)

    const ownerName = get('ownerName')
    const ownerPhone = get('ownerPhone')
    if (!ownerName) errors.push('Owner name is missing')
    if (!ownerPhone) errors.push('Owner telephone is missing')

    const make = get('make')
    const model = get('model')
    if (!make) errors.push('Car type / make is missing')
    if (!model) errors.push('Model is missing')

    const year = parseYear(get('year'))
    if (year.error) errors.push(year.error)

    const price = parsePrice(get('price'))
    if (price.error) errors.push(price.error)

    const rawKeys = get('keys')
    let keys = 1
    if (rawKeys) {
      const n = Number(rawKeys.replace(/\.0+$/, ''))
      if (!Number.isInteger(n) || n < 0) errors.push(`Keys "${rawKeys}" is not a whole number`)
      else keys = n
    }

    const vin = normalizeVin(get('vin'))
    if (vin) {
      const check = checkVin(vin)
      if (!check.wellFormed) {
        errors.push(check.problem ?? 'That VIN is not usable')
      } else {
        if (check.checkDigitOk === false) warnings.push('VIN check digit does not match')
        if (existingVins.has(vin)) errors.push(`A vehicle with VIN ${vin} is already on record`)
        const earlier = seenVins.get(vin)
        if (earlier) errors.push(`Same VIN as row ${earlier}`)
        else seenVins.set(vin, lineNumber)
      }
    }

    const bodyType = matchBodyType(get('bodyType'))
    if (bodyType.warning) warnings.push(bodyType.warning)

    const intake = parseSheetDate(get('intakeDate'), today)
    if (intake.warning) warnings.push(intake.warning)

    const email = get('ownerEmail')
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      warnings.push(`Email "${email}" looks wrong; left blank`)
    }

    const key = phoneKey(ownerPhone)
    const existing = key
      ? existingOwners.find(
          (o) => phoneKey(o.phone_primary) === key || phoneKey(o.phone_secondary) === key,
        )
      : undefined
    if (existing && existing.full_name.toLowerCase() !== ownerName.toLowerCase()) {
      warnings.push(`That number already belongs to ${existing.full_name}; attached to them`)
    }

    prepared.push({
      lineNumber,
      values,
      errors,
      warnings,
      owner: {
        full_name: ownerName,
        phone_primary: ownerPhone,
        phone_secondary: get('ownerPhone2') || null,
        email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
        existingOwnerId: existing?.id ?? null,
      },
      vehicle: {
        make,
        model,
        body_type: bodyType.value,
        year: year.value,
        vin: vin || null,
        color: get('color') || null,
        plate_number: get('plate')?.toUpperCase() || null,
        keys_count: keys,
        price: price.value,
        intake_date: intake.value,
        notes: get('notes') || null,
      },
    })
  })

  return prepared
}

/** Rows with no blocking errors — the ones that will actually be created. */
export function importableRows(rows: PreparedRow[]) {
  return rows.filter((row) => row.errors.length === 0)
}
