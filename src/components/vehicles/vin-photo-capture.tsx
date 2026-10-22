import * as React from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useDecodeVin } from '@/hooks/use-decode-vin'
import { fileToCompressedDataUrl } from '@/lib/image'
import { cn } from '@/lib/utils'
import type { VinReadResult } from '@/types/vin'

const MAX_PHOTOS = 3

interface Shot {
  id: string
  dataUrl: string
}

interface VinPhotoCaptureProps {
  /** Called with whatever the read could establish, for the form to apply. */
  onDecoded: (result: VinReadResult) => void
}

export function VinPhotoCapture({ onDecoded }: VinPhotoCaptureProps) {
  const [shots, setShots] = React.useState<Shot[]>([])
  const [preparing, setPreparing] = React.useState(false)
  const [result, setResult] = React.useState<VinReadResult | null>(null)
  const decode = useDecodeVin()

  const fileInput = React.useRef<HTMLInputElement>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - shots.length
    if (room <= 0) {
      toast.error(`Three photos is the most it will read at once.`)
      return
    }

    setPreparing(true)
    try {
      const picked = Array.from(files).slice(0, room)
      const prepared = await Promise.all(
        picked.map(async (file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: await fileToCompressedDataUrl(file),
        })),
      )
      setShots((current) => [...current, ...prepared])
      setResult(null)
    } catch {
      toast.error('That file could not be read as a photo.')
    } finally {
      setPreparing(false)
    }
  }

  const removeShot = (id: string) => {
    setShots((current) => current.filter((shot) => shot.id !== id))
    setResult(null)
  }

  const runDecode = async () => {
    if (shots.length === 0) return
    try {
      const read = await decode.mutateAsync(shots.map((shot) => shot.dataUrl))
      setResult(read)
      if (read.readable) {
        onDecoded(read)
      } else {
        toast.error(read.reason ?? 'The VIN was not legible in that photo.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that photo.')
    }
  }

  const busy = preparing || decode.isPending

  return (
    <section className="space-y-3 rounded-2xl border border-white/40 bg-white/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <ScanLine className="size-3.5" />
          Read the VIN from a photo
        </Label>
        <span className="text-[0.7rem] text-muted-foreground">
          {shots.length}/{MAX_PHOTOS}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Photograph the VIN plate or door sticker and the make will be filled in for
        you. Always check it against the plate before saving.
      </p>

      {/* One input, deliberately without `capture`: a phone then offers the
          camera or the photo library, which is what "upload or capture" means. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void addFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {shots.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {shots.map((shot) => (
            <li key={shot.id} className="relative">
              <img
                src={shot.dataUrl}
                alt="VIN plate"
                className="size-24 rounded-xl border border-white/50 object-cover"
              />
              <button
                type="button"
                onClick={() => removeShot(shot.id)}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-white/60 bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {/* With no photo this picks one; once there is one it reads it. */}
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => (shots.length === 0 ? fileInput.current?.click() : void runDecode())}
        >
          {busy ? <Loader2 className="animate-spin" /> : shots.length === 0 ? <Camera /> : <Sparkles />}
          {decode.isPending
            ? 'Reading…'
            : preparing
              ? 'Preparing…'
              : shots.length === 0
                ? 'Upload or capture'
                : 'Read VIN'}
        </Button>

        {shots.length > 0 && shots.length < MAX_PHOTOS ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus /> Add another angle
          </Button>
        ) : null}
      </div>

      {result ? <ReadSummary result={result} /> : null}
    </section>
  )
}

function ReadSummary({ result }: { result: VinReadResult }) {
  if (!result.readable) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <span>
            {result.reason ?? 'No VIN was legible.'}
            {result.notes ? <span className="block opacity-80">{result.notes}</span> : null}
          </span>
        </p>
        {/* Showing the rejected reading lets the user see what went wrong —
            usually a cropped plate — instead of just "unreadable". */}
        {result.rawVin ? (
          <p className="mt-1.5 pl-5 font-mono text-[0.78rem] opacity-80">
            read: {result.rawVin}
          </p>
        ) : null}
        <p className="mt-1.5 pl-5 opacity-80">
          Get the whole plate in frame, straight on, out of direct glare.
        </p>
      </div>
    )
  }

  const uncertain = result.uncertain ?? []
  const suspect =
    result.checkDigitOk === false || result.confidence !== 'high' || uncertain.length > 0

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 text-xs',
        suspect
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-primary/50 bg-primary/20',
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {suspect ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0" />
        )}
        Filled in from the photo
      </p>

      <p className="mt-1.5 font-mono text-[0.78rem] tracking-tight">{result.vin}</p>

      <p className="mt-1 text-muted-foreground">
        {[result.year, result.make, result.model].filter(Boolean).join(' ') || 'Make not identified'}
        {result.source === 'nhtsa' ? (
          <span className="ml-1.5 opacity-75">· decoded from the VIN (NHTSA)</span>
        ) : result.source === 'model' ? (
          <span className="ml-1.5 opacity-75">· read off the plate, unverified</span>
        ) : null}
      </p>

      {result.checkDigitOk === false ? (
        <p className="mt-1.5 text-destructive">
          The check digit does not match, so a character was probably misread. Compare it
          with the plate before saving. (Some non-US vehicles legitimately have none.)
        </p>
      ) : uncertain.length > 0 ? (
        <p className="mt-1.5">
          Double-check character{uncertain.length === 1 ? '' : 's'}{' '}
          <span className="font-medium">{uncertain.join(', ')}</span> — the photo was not
          clear there.
        </p>
      ) : result.confidence !== 'high' ? (
        <p className="mt-1.5">
          Read with {result.confidence} confidence — compare it with the plate.
        </p>
      ) : (
        <p className="mt-1.5 text-muted-foreground">
          Check it against the plate — a lookalike character can still pass validation.
        </p>
      )}
    </div>
  )
}
