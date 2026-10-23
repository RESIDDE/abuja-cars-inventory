/**
 * A phone camera photo is several megabytes and a few thousand pixels wide.
 * Sending that verbatim is slow and costs tokens for detail no OCR needs, and
 * storing it verbatim wastes the bucket, so every picture is resized and
 * re-encoded before it leaves the device.
 */

/** Matches the ceiling enforced on the storage bucket. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const VIN_MAX_EDGE = 1600
const VIN_QUALITY = 0.85

/**
 * Photo encoding targets.
 *
 * These are condition photographs — somebody will zoom in later to argue about
 * a scratch — so "smallest" is bounded by staying legible. Rather than pick one
 * quality and hope, the encoder walks down the ladder until the result is under
 * the target, which adapts to whatever the picture actually is: a plain shot of
 * a door panel lands at the top of the ladder, a busy forecourt further down.
 */
const PHOTO_TARGET_BYTES = 150 * 1024
/** Dropped to the second value if the ladder bottoms out still over target. */
const PHOTO_EDGE_STEPS = [1600, 1200] as const
/** Descending. Below about 0.45 WebP goes visibly blocky. */
const PHOTO_QUALITY_LADDER = [0.78, 0.7, 0.62, 0.54, 0.46] as const

export function formatBytes(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/**
 * Pure, so it can be tested without a browser. Returns a message to show, or
 * null when the file is acceptable.
 */
export function validatePhotoFile(file: { type: string; size: number; name: string }) {
  if (!file.type.startsWith('image/')) {
    return `${file.name} is not an image.`
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(
      MAX_UPLOAD_BYTES,
    )}.`
  }
  if (file.size === 0) {
    return `${file.name} is empty.`
  }
  return null
}

function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function drawToCanvas(file: File, maxEdge: number) {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read that image')
    context.drawImage(bitmap, 0, 0, width, height)
    return { canvas, width, height }
  } finally {
    bitmap.close()
  }
}

/** JPEG data URL, for sending a VIN plate to the reader. Not stored. */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const { canvas } = await drawToCanvas(file, VIN_MAX_EDGE)
  return canvas.toDataURL('image/jpeg', VIN_QUALITY)
}

export interface PreparedPhoto {
  blob: Blob
  previewUrl: string
  width: number
  height: number
  /** Size of the file the user chose. */
  originalBytes: number
  /** Size after conversion — normally a small fraction of the original. */
  bytes: number
}

/**
 * Converts a picture to WebP. The storage bucket only accepts image/webp, so a
 * browser that cannot encode it is reported plainly rather than uploading
 * something the bucket will reject.
 */
export async function fileToWebp(file: File): Promise<PreparedPhoto> {
  const problem = validatePhotoFile(file)
  if (problem) throw new Error(problem)

  let best: { blob: Blob; width: number; height: number } | null = null

  for (const maxEdge of PHOTO_EDGE_STEPS) {
    const { canvas, width, height } = await drawToCanvas(file, maxEdge)

    for (const quality of PHOTO_QUALITY_LADDER) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', quality)
      })
      if (!blob) continue
      if (blob.type !== 'image/webp') {
        throw new Error(
          'This browser cannot save WebP images. Try Chrome, Edge, Safari or Firefox.',
        )
      }

      // Keep whichever attempt is smallest, so a browser whose encoder does not
      // shrink monotonically still ends up with its best result.
      if (!best || blob.size < best.blob.size) best = { blob, width, height }
      if (blob.size <= PHOTO_TARGET_BYTES) {
        return {
          blob,
          previewUrl: URL.createObjectURL(blob),
          width,
          height,
          originalBytes: file.size,
          bytes: blob.size,
        }
      }
    }

    // Already comfortably small at this size; shrinking further would only cost
    // detail for a few kilobytes.
    if (best && best.blob.size <= PHOTO_TARGET_BYTES * 1.2) break
  }

  if (!best) throw new Error('That image could not be converted.')

  return {
    blob: best.blob,
    previewUrl: URL.createObjectURL(best.blob),
    width: best.width,
    height: best.height,
    originalBytes: file.size,
    bytes: best.blob.size,
  }
}

/** Exposed so the ladder itself can be checked without a browser. */
export const photoEncodingPlan = {
  targetBytes: PHOTO_TARGET_BYTES,
  edgeSteps: PHOTO_EDGE_STEPS,
  qualityLadder: PHOTO_QUALITY_LADDER,
}
