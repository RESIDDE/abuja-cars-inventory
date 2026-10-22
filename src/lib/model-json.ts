/**
 * Pull a JSON object out of a model's reply.
 *
 * Models wrap JSON in ``` fences however firmly the prompt asks them not to —
 * observed in testing from the Gemini flash models, while Qwen and Claude
 * returned it bare. Both shapes have to work.
 *
 * Mirrored in supabase/functions/decode-vin/index.ts, which runs on Deno and
 * cannot import from src/.
 */
export function parseModelJson(raw: string): Record<string, unknown> | null {
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
