import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { VinReadResult } from '@/types/vin'

/**
 * Reads a VIN off photos.
 *
 * The real path is the `decode-vin` edge function, which holds the OpenRouter
 * key server-side. In development only, a direct browser call is allowed as a
 * fallback so the feature can be tried before the function is deployed — that
 * branch is statically dead in a production build, so neither the module nor
 * the key reaches the shipped bundle.
 */
export function useDecodeVin() {
  return useMutation({
    mutationFn: async (images: string[]): Promise<VinReadResult> => {
      const { data, error } = await supabase.functions.invoke<VinReadResult>('decode-vin', {
        body: { images },
      })

      if (!error && data) return data

      if (import.meta.env.DEV && import.meta.env.VITE_OPENROUTER_API_KEY) {
        console.warn(
          '[decode-vin] edge function unavailable — falling back to a direct browser call. ' +
            'This only works in development; deploy the function before going live.',
        )
        const { decodeVinInBrowser } = await import('@/lib/decode-vin-dev')
        return decodeVinInBrowser(images)
      }

      // supabase-js hides the function's own error body behind a generic
      // message, so dig it out when it is there.
      const context = (error as { context?: Response } | null)?.context
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json()
          if (body?.error) throw new Error(body.error)
        } catch (parsed) {
          if (parsed instanceof Error && parsed.message) throw parsed
        }
      }
      throw new Error(
        error?.message ??
          'Reading photos is not set up yet. Deploy the decode-vin function to enable it.',
      )
    },
  })
}
