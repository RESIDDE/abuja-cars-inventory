import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  /**
   * One state object, deliberately. Setting the user first and then awaiting a
   * follow-up fetch publishes a frame where auth is half-initialised, and the
   * route guards flash an error screen before correcting themselves. Anything
   * else the context needs must be resolved BEFORE this single setState.
   */
  const [state, setState] = React.useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  })

  React.useEffect(() => {
    let active = true

    const publish = (session: Session | null) => {
      if (!active) return
      // Any follow-up fetch (a staff profile, a role lookup) belongs above this
      // line, awaited, so that user + session + isLoading land together.
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
      })
    }

    supabase.auth
      .getSession()
      .then(({ data }) => publish(data.session ?? null))
      .catch(() => publish(null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      publish(session ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    setState({ user: null, session: null, isLoading: false })
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, signOut }),
    [state, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
