import { useQuery } from '@tanstack/react-query'

import { signedPhotoUrls } from '@/lib/storage'
import type { VehiclePhoto } from '@/types/database'

/**
 * Signed URLs for stored photos. They expire, so they are fetched per view
 * rather than stored on the record.
 */
export function usePhotoUrls(photos: VehiclePhoto[] | undefined) {
  const paths = (photos ?? []).map((photo) => photo.path)

  return useQuery({
    queryKey: ['photo-urls', paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: () => signedPhotoUrls(paths),
  })
}
