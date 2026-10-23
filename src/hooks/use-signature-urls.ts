import { useQuery } from '@tanstack/react-query'

import { signedSignatureUrls } from '@/lib/storage'
import type { VehicleEvent } from '@/types/database'

/** Signed URLs for the signatures on a set of movements. They expire. */
export function useSignatureUrls(events: VehicleEvent[] | undefined) {
  const paths = (events ?? [])
    .map((event) => event.signature_path)
    .filter((path): path is string => Boolean(path))

  return useQuery({
    queryKey: ['signature-urls', paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: () => signedSignatureUrls(paths),
  })
}
