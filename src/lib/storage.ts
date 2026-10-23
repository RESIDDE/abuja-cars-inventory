import { supabase } from '@/lib/supabase'
import type { PreparedPhoto } from '@/lib/image'
import type { VehiclePhoto } from '@/types/database'

export const VEHICLE_PHOTOS_BUCKET = 'vehicle-photos'

/** Signed URLs are short-lived on purpose — the bucket is private. */
const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * Uploads prepared (already WebP) pictures under the vehicle's own folder, so
 * deleting a vehicle's photos is a single prefix operation.
 */
export async function uploadVehiclePhotos(
  vehicleId: string,
  photos: PreparedPhoto[],
): Promise<VehiclePhoto[]> {
  const stored: VehiclePhoto[] = []

  for (const [index, photo] of photos.entries()) {
    const path = `${vehicleId}/${Date.now()}-${index}.webp`
    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .upload(path, photo.blob, { contentType: 'image/webp', upsert: false })
    if (error) throw error
    stored.push({
      path,
      bytes: photo.bytes,
      width: photo.width,
      height: photo.height,
    })
  }

  return stored
}

export async function removeVehiclePhotos(paths: string[]) {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove(paths)
  if (error) throw error
}

/** Best-effort cleanup — used when a save fails after photos went up. */
export async function discardVehiclePhotos(paths: string[]) {
  if (paths.length === 0) return
  try {
    await removeVehiclePhotos(paths)
  } catch {
    // An orphaned object is untidy, not harmful; never mask the real error.
  }
}

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) throw error

  const map: Record<string, string> = {}
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl
  }
  return map
}

export const SIGNATURES_BUCKET = 'movement-signatures'

/**
 * Uploads a signature and returns its path.
 *
 * Note there is no delete counterpart: the bucket grants staff select and
 * insert only. A signature is evidence attached to a movement, and quietly
 * swapping or removing one while leaving the movement intact is exactly what
 * should not be possible from the app.
 */
export async function uploadSignature(vehicleId: string, blob: Blob): Promise<string> {
  const path = `${vehicleId}/${Date.now()}.webp`
  const { error } = await supabase.storage
    .from(SIGNATURES_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw error
  return path
}

export async function signedSignatureUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(SIGNATURES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl
  }
  return map
}
