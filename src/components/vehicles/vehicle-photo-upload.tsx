import * as React from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { usePhotoUrls } from '@/hooks/use-photo-urls'
import { fileToWebp, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/image'
import type { PreparedPhoto } from '@/lib/image'
import type { VehiclePhoto } from '@/types/database'

const MAX_PHOTOS = 6

interface VehiclePhotoUploadProps {
  /** Newly chosen pictures, converted but not yet uploaded. */
  value: PreparedPhoto[]
  onChange: (next: PreparedPhoto[]) => void
  /** Already stored on the record (edit mode). */
  existing?: VehiclePhoto[]
  onRemoveExisting?: (path: string) => void
}

export function VehiclePhotoUpload({
  value,
  onChange,
  existing = [],
  onRemoveExisting,
}: VehiclePhotoUploadProps) {
  const [preparing, setPreparing] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const { data: urls = {} } = usePhotoUrls(existing)

  const total = existing.length + value.length

  // Object URLs for the previews are released when the picture goes away.
  React.useEffect(() => {
    return () => {
      for (const photo of value) URL.revokeObjectURL(photo.previewUrl)
    }
    // Only on unmount: removal already revokes its own URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - total
    if (room <= 0) {
      toast.error(`That is the most pictures a record will hold (${MAX_PHOTOS}).`)
      return
    }

    setPreparing(true)
    const prepared: PreparedPhoto[] = []
    try {
      for (const file of Array.from(files).slice(0, room)) {
        try {
          prepared.push(await fileToWebp(file))
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'That picture could not be used.')
        }
      }
      if (prepared.length > 0) {
        const saved = prepared.reduce((sum, p) => sum + (p.originalBytes - p.bytes), 0)
        onChange([...value, ...prepared])
        if (saved > 0) {
          toast.success(
            `Converted to WebP — ${formatBytes(saved)} smaller`,
          )
        }
      }
    } finally {
      setPreparing(false)
    }
  }

  const removeNew = (index: number) => {
    const photo = value[index]
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/40 bg-white/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <ImagePlus className="size-3.5" />
          Pictures of the vehicle
        </Label>
        <span className="text-[0.7rem] text-muted-foreground">
          {total}/{MAX_PHOTOS}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Up to {formatBytes(MAX_UPLOAD_BYTES)} each. Every picture is converted to WebP
        before it is stored, so it takes a fraction of the space.
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void addFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {total > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {existing.map((photo) => (
            <li key={photo.path} className="relative">
              <img
                src={urls[photo.path]}
                alt="Vehicle"
                className="size-24 rounded-xl border border-white/50 bg-white/30 object-cover"
              />
              <span className="absolute inset-x-1 bottom-1 rounded-md bg-[hsl(160_20%_18%/.65)] px-1 py-0.5 text-center text-[0.6rem] text-white">
                {formatBytes(photo.bytes)}
              </span>
              {onRemoveExisting ? (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(photo.path)}
                  aria-label="Remove stored picture"
                  className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-white/60 bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </li>
          ))}

          {value.map((photo, index) => (
            <li key={photo.previewUrl} className="relative">
              <img
                src={photo.previewUrl}
                alt="Vehicle"
                className="size-24 rounded-xl border border-white/50 object-cover"
              />
              <span className="absolute inset-x-1 bottom-1 rounded-md bg-[hsl(160_20%_18%/.65)] px-1 py-0.5 text-center text-[0.6rem] text-white">
                {formatBytes(photo.originalBytes)} → {formatBytes(photo.bytes)}
              </span>
              <button
                type="button"
                onClick={() => removeNew(index)}
                aria-label="Remove picture"
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-white/60 bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/50 px-4 py-3 text-xs text-muted-foreground">
          No pictures yet. At least one is worth having — it settles arguments about
          what condition the car arrived in.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={preparing || total >= MAX_PHOTOS}
        onClick={() => input.current?.click()}
      >
        {preparing ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {preparing ? 'Converting…' : total > 0 ? 'Add another' : 'Upload or capture'}
      </Button>
    </section>
  )
}
