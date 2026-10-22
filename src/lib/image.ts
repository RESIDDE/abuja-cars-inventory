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

const PHOTO_MAX_EDGE = 1800
const PHOTO_QUALITY = 0.82

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

  const { canvas, width, height } = await drawToCanvas(file, PHOTO_MAX_EDGE)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', PHOTO_QUALITY)
  })

  if (!blob) throw new Error('That image could not be converted.')
  if (blob.type !== 'image/webp') {
    throw new Error('This browser cannot save WebP images. Try Chrome, Edge, Safari or Firefox.')
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    originalBytes: file.size,
    bytes: blob.size,
  }
}
