import type { Owner } from '@/types/database'

/**
 * The same number gets typed half a dozen ways — "0803 111 2222",
 * "08031112222", "+234 803 111 2222", "234-803-111-2222". Comparing the last
 * ten digits collapses all of those onto one key: a Nigerian mobile is the
 * trunk prefix or +234 country code followed by a ten-digit subscriber number,
 * so the tail is the part that actually identifies the line.
 */
export function phoneKey(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < MIN_MATCH_DIGITS) return ''
  return digits.slice(-10)
}

/** Below this there is not enough typed to suggest anything useful. */
export const MIN_MATCH_DIGITS = 7

/**
 * Owners already on record reachable on this number, checking both of their
 * numbers. `excludeId` keeps an owner from matching itself while being edited.
 */
export function findOwnersByPhone(
  owners: Owner[],
  phone: string | null | undefined,
  excludeId?: string,
): Owner[] {
  const key = phoneKey(phone)
  if (!key) return []

  return owners.filter((owner) => {
    if (excludeId && owner.id === excludeId) return false
    return phoneKey(owner.phone_primary) === key || phoneKey(owner.phone_secondary) === key
  })
}
