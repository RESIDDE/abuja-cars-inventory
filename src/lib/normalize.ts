import type {
  Belonging,
  Owner,
  Vehicle,
  VehiclePhoto,
  VehicleWithOwner,
} from '@/types/database'

/**
 * jsonb round-trips as unknown. Anything that isn't a usable row is dropped
 * rather than crashing a card render.
 */
export function normalizeBelongings(raw: unknown): Belonging[] {
  const list = typeof raw === 'string' ? safeParse(raw) : raw
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const item = typeof row.item === 'string' ? row.item.trim() : ''
    if (!item) return []
    const qty = Number(row.qty)
    const note = typeof row.note === 'string' ? row.note : null
    return [{ item, qty: Number.isFinite(qty) && qty > 0 ? qty : 1, note }]
  })
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

/** Drops anything in the photos column that isn't a usable stored picture. */
export function normalizePhotos(raw: unknown): VehiclePhoto[] {
  const list = typeof raw === 'string' ? safeParse(raw) : raw
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const path = typeof row.path === 'string' ? row.path.trim() : ''
    if (!path) return []
    const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)
    return [{ path, bytes: num(row.bytes), width: num(row.width), height: num(row.height) }]
  })
}

export function normalizeVehicle(row: Record<string, unknown>): VehicleWithOwner {
  const { owner, belongings, photos, price, ...rest } = row as unknown as Vehicle & {
    owner?: Owner | Owner[] | null
  }

  return {
    ...(rest as Omit<Vehicle, 'belongings' | 'photos' | 'price'>),
    belongings: normalizeBelongings(belongings),
    photos: normalizePhotos(photos),
    // numeric(12,2) arrives as a string on some driver paths.
    price: price === null || price === undefined ? null : Number(price),
    owner: Array.isArray(owner) ? owner[0] ?? null : owner ?? null,
  }
}
