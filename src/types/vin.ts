/** What the decode-vin function returns. Mirrored in supabase/functions/decode-vin. */
export interface VinReadResult {
  vin: string | null
  readable: boolean
  checkDigitOk?: boolean | null
  confidence: string
  /** 1-based character positions the model was unsure of. */
  uncertain?: number[]
  notes: string | null
  /** Set when the VIN could not be read. */
  reason?: string
  /** What was read, when it was rejected as malformed — shown so the user can judge. */
  rawVin?: string | null
  make?: string | null
  model?: string | null
  year?: string | null
  bodyClass?: string | null
  /** 'nhtsa' when the authoritative decoder answered, 'model' when it didn't. */
  source?: 'nhtsa' | 'model' | null
  modelUsed?: string
}
