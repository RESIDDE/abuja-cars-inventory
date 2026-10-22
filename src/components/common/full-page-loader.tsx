import { Loader2 } from 'lucide-react'

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="glass-tile-solid flex items-center gap-3 rounded-full px-6 py-3">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
