import { cn } from '@/lib/utils'

/** Served straight from public/, so index.html's icon tags and the in-app
 *  mark point at the same stable path. */
const LOGO_URL = '/abujacar-logo.png'

/**
 * The AbujaCar badge. The artwork is already circular on a black field with a
 * white ring just inside the edge, so cropping to a circle lands on the ring
 * and trims only the black corners.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      decoding="async"
      className={cn(
        'size-10 shrink-0 rounded-full object-cover ring-1 ring-white/50 shadow-[0_8px_18px_-10px_hsl(160_20%_20%/.65)]',
        className,
      )}
    />
  )
}
