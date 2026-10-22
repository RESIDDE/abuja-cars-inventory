/**
 * DEVELOPMENT ONLY — a direct browser call to OpenRouter, so the feature can
 * be tried before the edge function is deployed.
 *
 * Every caller guards this behind `import.meta.env.DEV`, which is statically
 * false in a production build, so this module and the key it reads are dropped
 * from the bundle entirely. Never remove that guard: a key shipped to the
 * browser is a key anyone can read out of the bundle and spend.
 */
import { parseModelJson } from '@/lib/model-json'
import { bodyTypeFromBodyClass, checkVin, makeFromWmi, normalizeVin } from '@/lib/vin'
import type { VinReadResult } from '@/types/vin'

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

async function decodeWithVpic(vin: string) {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`,
    )
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
    return null
  }
}

export async function decodeVinInBrowser(images: string[]): Promise<VinReadResult> {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
  if (!key) throw new Error('Set VITE_OPENROUTER_API_KEY in .env, or deploy the decode-vin function.')

  const model =
    (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) ??
    'qwen/qwen3-vl-235b-a22b-instruct'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            ...images.slice(0, 3).map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`The reading service returned ${response.status}.`)
  }

  const payload = await response.json()
  const parsed = parseModelJson(payload?.choices?.[0]?.message?.content ?? '')
  if (!parsed) throw new Error('Could not make sense of the reading. Try another photo.')

  const vin = normalizeVin(typeof parsed.vin === 'string' ? parsed.vin : '')
  const confidence = typeof parsed.confidence === 'string' ? parsed.confidence : 'low'
  const notes = typeof parsed.notes === 'string' ? parsed.notes : null
  const uncertain = Array.isArray(parsed.uncertain)
    ? parsed.uncertain.filter((n): n is number => typeof n === 'number')
    : []
  const check = checkVin(vin)

  if (!vin || !check.wellFormed) {
    return {
      vin: null,
      readable: false,
      rawVin: vin || null,
      confidence,
      uncertain,
      notes,
      reason: vin
        ? `That read back as ${vin.length} usable characters, so it is not a VIN.`
        : 'No VIN was legible in that photo.',
      modelUsed: model,
    }
  }

  const vpic = await decodeWithVpic(vin)
  const modelMake = typeof parsed.make === 'string' ? parsed.make : null

  return {
    vin,
    readable: true,
    checkDigitOk: check.checkDigitOk,
    confidence,
    uncertain,
    notes,
    make: vpic?.make ?? modelMake ?? makeFromWmi(vin),
    model: vpic?.model ?? null,
    year: vpic?.year ?? null,
    bodyClass: vpic?.bodyClass ?? bodyTypeFromBodyClass(null),
    source: vpic ? 'nhtsa' : modelMake ? 'model' : null,
    modelUsed: model,
  }
}
