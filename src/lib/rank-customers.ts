import type { Owner } from '@/types/database'

export type CustomerScope = 'all' | 'storing' | 'buyers'

export interface RankedCustomer {
  owner: Owner
  stored: number
  bought: number
  /** What the current scope ranks on. */
  score: number
  /** 1-based position, or null when there is nothing to rank by. */
  rank: number | null
}

export interface RankInput {
  owners: Owner[]
  /** Vehicles stored, by owner id. */
  storedCounts: Record<string, number>
  /** Vehicles bought, by customer id. */
  boughtCounts: Record<string, number>
  scope: CustomerScope
  by: 'activity' | 'name'
}

/**
 * Orders customers by how much business they have done, busiest first.
 *
 * The score follows the scope on screen: the Buyers tab ranks on purchases
 * alone, Storing on vehicles held, and Everyone on the two together — ranking
 * the Buyers list by a total that includes stored cars would put someone who
 * has bought nothing above someone who has bought three.
 *
 * Ties break on name so the order never shuffles between renders, and anyone
 * with a score of zero gets no rank at all rather than a meaningless one.
 */
export function rankCustomers({
  owners,
  storedCounts,
  boughtCounts,
  scope,
  by,
}: RankInput): RankedCustomer[] {
  const rows = owners.map((owner) => {
    const stored = storedCounts[owner.id] ?? 0
    const bought = boughtCounts[owner.id] ?? 0
    const score = scope === 'buyers' ? bought : scope === 'storing' ? stored : stored + bought
    return { owner, stored, bought, score, rank: null as number | null }
  })

  if (by === 'name') {
    rows.sort((a, b) => a.owner.full_name.localeCompare(b.owner.full_name))
    return rows
  }

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Within a tie, someone who has bought outranks someone who only stores.
    if (b.bought !== a.bought) return b.bought - a.bought
    return a.owner.full_name.localeCompare(b.owner.full_name)
  })

  let position = 0
  let previousScore: number | null = null
  rows.forEach((row, index) => {
    if (row.score === 0) {
      row.rank = null
      return
    }
    // Equal scores share a position, so two customers with four cars each are
    // both #1 rather than one being arbitrarily second.
    if (row.score !== previousScore) position = index + 1
    previousScore = row.score
    row.rank = position
  })

  return rows
}
