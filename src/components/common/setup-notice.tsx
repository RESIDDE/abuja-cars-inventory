import { Database } from 'lucide-react'

/** Shown instead of a stack trace when the Supabase keys are missing. */
export function SetupNotice() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="glass-hero w-full max-w-xl rounded-[2rem] p-8">
        <span className="grid size-12 place-items-center rounded-full border border-white/45 bg-white/45">
          <Database className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Connect your Supabase project
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AbujaCar Inventory needs a project URL and anon key before it can sign
          anyone in. Copy <code className="font-mono text-xs">.env.example</code> to{' '}
          <code className="font-mono text-xs">.env</code> and fill in:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/40 bg-white/40 p-4 font-mono text-xs leading-relaxed">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Then run{' '}
          <code className="font-mono text-xs">supabase/migrations/20261022090000_init.sql</code>{' '}
          in the SQL editor and restart the dev server.
        </p>
      </div>
    </div>
  )
}
