/**
 * decode-vin — reads a VIN off a photo and decodes what the vehicle is.
 *
 * This runs server-side for one reason: the OpenRouter API key. A Vite app
 * ships its entire bundle to the browser, so anything in a VITE_* variable is
 * readable by every visitor and could be used to spend the account's credit.
 * The key lives here, as a function secret, and the browser never sees it.
 *
 * Deploy:
 *   npx supabase secrets set OPENROUTER_API_KEY=sk-or-...
 *   npx supabase functions deploy decode-vin
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin'

// Chosen by testing against deliberately poor photos: the cheap flash-tier
// models returned confidently wrong VINs (one gave 19 characters and the wrong
// make), while this one read a glare-washed plate exactly.
const DEFAULT_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct'

const PROMPT = `You are reading the Vehicle Identification Number (VIN) plate or sticker of a car, for a vehicle custody record where a wrong character matters.

Return ONLY a JSON object. No prose, no markdown, no code fences. Keys:
  "vin": your best reading of the 17-character VIN, uppercase. Use null ONLY if the image shows no VIN at all.
  "make": the manufacturer if the plate states it, else null
  "confidence": "high" if every character is clearly legible, "medium" if you inferred one or two from context, "low" if more than two are doubtful
  "uncertain": array of 1-based character positions you are unsure of, or []
  "notes": a short note on any glare, blur or obstruction, or null

Rules:
- A VIN is exactly 17 characters and never contains the letters I, O or Q.
- Give your best full reading even where glare or blur makes some characters hard, and mark those positions in "uncertain". Do not suppress the whole VIN over a few doubtful characters - the reading is checked afterwards and shown to a person to confirm.
- Do not pad or truncate to reach 17 characters.
- Never invent a VIN when the image shows none; that is the only case for null.
- If several photos are given, they are the same plate from different angles; combine them.`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// --- VIN validation, mirrored from src/lib/vin.ts --------------------------

const TRANSLITERATION: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

function checkDigitOk(vin: string): boolean | null {
  if (vin.length !== 17) return null
  let total = 0
  for (let i = 0; i < 17; i += 1) {
    const value = TRANSLITERATION[vin[i]]
    if (value === undefined) return null
    total += value * WEIGHTS[i]
  }
  const remainder = total % 11
  return vin[8] === (remainder === 10 ? 'X' : String(remainder))
}

function wellFormed(vin: string) {
  return vin.length === 17 && !/[IOQ]/.test(vin) && /^[A-Z0-9]+$/.test(vin)
}

/** Models like to wrap JSON in ``` fences however firmly you ask them not to. */
function parseModelJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

async function decodeWithVpic(vin: string) {
  try {
    const response = await fetch(`${VPIC_URL}/${vin}?format=json`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const body = await response.json()
    const rows: { Variable: string; Value: string | null }[] = body.Results ?? []
    const get = (name: string) => {
      const value = rows.find((r) => r.Variable === name)?.Value
      return value && value !== 'Not Applicable' ? value : null
    }
    const make = get('Make')
    if (!make) return null
    return {
      make: make.charAt(0) + make.slice(1).toLowerCase(),
      model: get('Model'),
      year: get('Model Year'),
      bodyClass: get('Body Class'),
    }
  } catch {
    // The decoder being down must not take the whole read down with it.
    return null
  }
}

/**
 * Only AbujaCar staff may spend credit here.
 *
 * verify_jwt alone is not enough on a project shared with another application:
 * Supabase auth is per-project, so anyone who signs up through that other app
 * arrives holding a valid `authenticated` token for this one.
 *
 * The check is done with the CALLER's token against vi_staff, whose RLS policy
 * only returns rows to staff — so a non-staff caller simply sees an empty list.
 * No service-role key is needed, and none is used.
 *
 * If vi_staff does not exist yet (the staff_scope migration not applied), this falls back
 * to allowing any authenticated caller and says so in the logs, so deploying
 * the function does not break a project that has not been migrated.
 */
async function callerIsStaff(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authHeader || !url || !anonKey) return false

  try {
    const response = await fetch(`${url}/rest/v1/vi_staff?select=user_id&limit=1`, {
      headers: { apikey: anonKey, Authorization: authHeader },
      signal: AbortSignal.timeout(8000),
    })

    if (response.status === 404) {
      console.warn('vi_staff missing — apply the staff_scope migration to restrict this function to staff')
      return true
    }
    if (!response.ok) return false

    const rows = await response.json()
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  if (!(await callerIsStaff(req))) {
    return json({ error: 'This account is not authorised to read VIN photos.' }, 403)
  }

  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    return json(
      { error: 'This server has no OPENROUTER_API_KEY set, so photo reading is unavailable.' },
      500,
    )
  }

  let images: string[]
  try {
    const body = await req.json()
    images = Array.isArray(body?.images) ? body.images : []
  } catch {
    return json({ error: 'Send a JSON body of { images: [dataUrl, ...] }' }, 400)
  }

  if (images.length === 0) return json({ error: 'Attach at least one photo.' }, 400)
  if (images.length > 3) images = images.slice(0, 3)

  const model = Deno.env.get('OPENROUTER_MODEL') ?? DEFAULT_MODEL

  let completion: Response
  try {
    completion = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://abujacar.local',
        'X-Title': 'AbujaCar Inventory',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    return json({ error: 'Could not reach the reading service. Try again.' }, 502)
  }

  if (!completion.ok) {
    const detail = await completion.text()
    console.error('openrouter error', completion.status, detail.slice(0, 500))
    return json(
      {
        error:
          completion.status === 401 || completion.status === 403
            ? 'The reading service rejected this account’s key.'
            : 'The reading service is unavailable right now.',
      },
      502,
    )
  }

  const payload = await completion.json()
  const raw: string = payload?.choices?.[0]?.message?.content ?? ''
  const parsed = parseModelJson(raw)

  if (!parsed) {
    return json({ error: 'Could not make sense of the reading. Try another photo.' }, 422)
  }

  const vinRaw = typeof parsed.vin === 'string' ? parsed.vin : ''
  const vin = vinRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const confidence = typeof parsed.confidence === 'string' ? parsed.confidence : 'low'
  const notes = typeof parsed.notes === 'string' ? parsed.notes : null
  const uncertain = Array.isArray(parsed.uncertain)
    ? (parsed.uncertain as unknown[]).filter((n): n is number => typeof n === 'number')
    : []

  if (!vin || !wellFormed(vin)) {
    return json({
      vin: null,
      readable: false,
      rawVin: vin || null,
      confidence,
      uncertain,
      notes,
      reason: vin
        ? `That read back as ${vin.length} usable characters, so it is not a VIN.`
        : 'No VIN was legible in that photo.',
      model,
    })
  }

  const vpic = await decodeWithVpic(vin)
  const modelMake = typeof parsed.make === 'string' ? parsed.make : null

  return json({
    vin,
    readable: true,
    checkDigitOk: checkDigitOk(vin),
    confidence,
    uncertain,
    notes,
    make: vpic?.make ?? modelMake ?? null,
    model: vpic?.model ?? null,
    year: vpic?.year ?? null,
    bodyClass: vpic?.bodyClass ?? null,
    // Where the make came from, so the UI can be honest about it.
    source: vpic ? 'nhtsa' : modelMake ? 'model' : null,
    modelUsed: model,
  })
})
