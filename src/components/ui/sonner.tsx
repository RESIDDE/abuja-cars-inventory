import { Toaster as SonnerToaster } from 'sonner'

/**
 * Sonner renders into a portal on <body>, so it only picks up the palette
 * because the theme class is on the body as well (see useThemeClass).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={88}
      toastOptions={{
        classNames: {
          toast:
            'rounded-2xl border border-white/45 bg-[hsl(158_24%_88%/.9)] text-foreground shadow-[0_20px_44px_-20px_hsl(160_20%_20%/.4)] backdrop-blur-xl',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton: 'rounded-full bg-primary text-primary-foreground',
          cancelButton: 'rounded-full bg-white/50 text-foreground',
          error: 'border-destructive/40',
        },
      }}
    />
  )
}
