import type { Belonging } from '@/types/database'

const nairaFull = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const grouped = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

/** ₦12,500,000 — or a dash when no price was recorded. */
export function formatNaira(value: number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  return nairaFull.format(value)
}

/** ₦12.5M / ₦940k, for tiles where the full number would wrap. */
export function formatNairaCompact(value: number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  if (Math.abs(value) >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `₦${Math.round(value / 1_000)}k`
  return `₦${grouped.format(value)}`
}

/** Digits only, regrouped — what the currency input shows while you type. */
export function groupDigits(raw: string) {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return grouped.format(Number(digits))
}

export function parseCurrency(formatted: string): number | null {
  const digits = formatted.replace(/\D/g, '')
  if (!digits) return null
  return Number(digits)
}

/** 14 Mar 2025 — from a date-only column, without timezone drift. */
export function formatDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return fallback
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** 14 Mar 2025, 09:42 — for timestamps in the movement log. */
export function formatDateTime(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "3 days ago" / "in 2 hours", for timeline entries. */
export function formatRelative(value: string | null | undefined) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diff = then - Date.now()
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < minute) return 'just now'
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')
  if (abs < 365 * day) return rtf.format(Math.round(diff / (30 * day)), 'month')
  return rtf.format(Math.round(diff / (365 * day)), 'year')
}

/** yyyy-MM-dd for a <input type="date">, in local time. */
export function toDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** yyyy-MM-ddTHH:mm for a <input type="datetime-local">, in local time. */
export function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function vehicleTitle(v: {
  year?: number | null
  make: string
  model: string
}) {
  return [v.year ?? null, v.make, v.model].filter(Boolean).join(' ')
}

export function countBelongings(belongings: Belonging[] | null | undefined) {
  if (!Array.isArray(belongings)) return 0
  return belongings.reduce((total, b) => total + (Number(b.qty) || 0), 0)
}

/** A tel: href that survives spaces and dashes in the stored number. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}
