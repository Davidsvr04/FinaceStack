import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  /** true hasta conocer la sesión inicial (y el perfil, si hay sesión). */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  // Se guarda para qué usuario se cargó el perfil, así un cambio de sesión
  // nunca muestra el perfil anterior ni da por terminada la carga antes de tiempo.
  const [profileState, setProfileState] = useState<{
    userId: string | null
    profile: Profile | null
  } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })

    // No llamar a supabase dentro de este callback (puede bloquearse);
    // el perfil se carga en el efecto de abajo al cambiar el usuario.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!sessionLoaded) return
    if (!userId) {
      setProfileState({ userId: null, profile: null })
      return
    }

    let cancelled = false
    supabase
      .from('users_profiles')
      .select('id, role, full_name, created_at')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('No se pudo cargar el perfil', error)
        setProfileState({ userId, profile: data ?? null })
      })

    return () => {
      cancelled = true
    }
  }, [userId, sessionLoaded])

  const profileReady = sessionLoaded && profileState?.userId === userId
  const profile = profileReady ? profileState.profile : null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      loading: !profileReady,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp(email, password, fullName) {
        // full_name lo recoge el trigger handle_new_user para crear el perfil.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [session, profile, profileReady],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
