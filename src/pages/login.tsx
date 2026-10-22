import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { BrandMark } from '@/components/common/brand-mark'
import { FullPageLoader } from '@/components/common/full-page-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { describeAuthError } from '@/lib/errors'
import { authRedirectTo, supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('That email looks wrong'),
  password: z.string().min(6, 'At least 6 characters'),
})

type FormValues = z.infer<typeof schema>

type Mode = 'signIn' | 'signUp'

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const [mode, setMode] = React.useState<Mode>('signIn')
  const [showPassword, setShowPassword] = React.useState(false)
  const [sideAction, setSideAction] = React.useState<'reset' | 'magic' | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (isLoading) return <FullPageLoader label="Checking your session" />

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />
  }

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(describeAuthError(error))
        return
      }
      toast.success('Welcome back')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirectTo() },
    })
    if (error) {
      toast.error(describeAuthError(error))
      return
    }
    if (data.session) {
      toast.success('Account created')
    } else {
      toast.success('Check your inbox to confirm your email address')
    }
  })

  /** Both side actions need a valid email and nothing else. */
  const emailOnly = async (action: 'reset' | 'magic') => {
    const email = form.getValues('email').trim()
    const parsed = schema.shape.email.safeParse(email)
    if (!parsed.success) {
      form.setError('email', { message: 'Enter your email address first' })
      return
    }

    setSideAction(action)
    try {
      if (action === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirectTo(),
        })
        if (error) throw error
        toast.success('Password reset link sent — check your email')
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: authRedirectTo() },
        })
        if (error) throw error
        toast.success('Sign-in link sent — check your email')
      }
    } catch (error) {
      toast.error(describeAuthError(error))
    } finally {
      setSideAction(null)
    }
  }

  const busy = form.formState.isSubmitting

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="page-enter glass-hero w-full max-w-md rounded-[2rem] p-7 sm:p-9">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-base font-semibold tracking-tight">AbujaCar</p>
            <p className="text-xs text-muted-foreground">Inventory &amp; custody</p>
          </div>
        </div>

        <h1 className="mt-7 text-3xl tracking-tight text-display">
          {mode === 'signIn' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'signIn'
            ? 'Sign in to see what is on the lot today.'
            : 'Set up an account for your yard staff.'}
        </p>

        {/* Mode toggle */}
        <div
          className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/35 bg-white/25 p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          {(
            [
              ['signIn', 'Sign in'],
              ['signUp', 'Create account'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value)
                form.clearErrors()
              }}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                mode === value
                  ? 'pill-nav-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@abujacar.ng"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="pr-12"
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void emailOnly('reset')}
            disabled={sideAction !== null}
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            {sideAction === 'reset' ? 'Sending reset link…' : 'Forgot password?'}
          </button>

          <div className="flex w-full items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/40" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-white/40" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void emailOnly('magic')}
            disabled={sideAction !== null}
          >
            {sideAction === 'magic' ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            Email me a link
          </Button>
        </div>
      </div>
    </div>
  )
}
