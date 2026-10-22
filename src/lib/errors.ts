/** Postgres / PostgREST error shape as it reaches the client. */
interface SupabaseLikeError {
  message?: string
  code?: string
  details?: string
  hint?: string
}

function asError(error: unknown): SupabaseLikeError {
  if (error && typeof error === 'object') return error as SupabaseLikeError
  return { message: String(error) }
}

/**
 * Turns a raw database failure into something a person in the yard can act on.
 * The VIN clash is the one that actually happens day to day: a partial unique
 * index on upper(vin) rejects it, and `duplicate key value violates unique
 * constraint "vi_vehicles_vin_unique_idx"` is not a useful thing to show.
 */
export function describeDbError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const err = asError(error)
  const message = err.message ?? ''

  if (err.code === '23505' || /duplicate key value/i.test(message)) {
    if (/vin/i.test(message) || /vin/i.test(err.details ?? '')) {
      return 'A vehicle with that VIN is already on record'
    }
    return 'That record already exists.'
  }

  if (err.code === '23503') {
    return 'That owner no longer exists. Refresh and try again.'
  }

  if (err.code === '23514') {
    return 'Some of those values are out of range. Check keys and status.'
  }

  // PostgREST returns this when .single() matched no row — almost always
  // because the record was deleted by someone else while this screen was open.
  if (err.code === 'PGRST116' || /coerce the result to a single json object/i.test(message)) {
    return 'That record no longer exists — someone may have deleted it. The list has been refreshed.'
  }

  if (err.code === 'P0002' || /not found/i.test(message)) {
    return 'That vehicle could not be found. It may have been deleted.'
  }

  if (err.code === '42501' || /row-level security/i.test(message)) {
    // Usually means the signed-in account is not on the vi_staff allowlist —
    // which is exactly what should happen to an account from another app
    // sharing this Supabase project.
    return 'This account is not on the AbujaCar staff list, so it cannot see or change records. Ask an administrator to add it.'
  }

  if (/fetch|network/i.test(message)) {
    return 'Could not reach the server. Check your connection.'
  }

  return message || fallback
}

/** Supabase auth messages are mostly fine; these few are not. */
export function describeAuthError(error: unknown) {
  const message = asError(error).message ?? ''

  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match an account.'
  }
  if (/user already registered/i.test(message)) {
    return 'That email already has an account. Sign in instead.'
  }
  if (/password should be at least/i.test(message)) {
    return 'Password must be at least 6 characters.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email address first — check your inbox.'
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return message || 'Authentication failed. Please try again.'
}
