import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); return }
    setLoading(true)
    supabase.from('profiles').select('*').eq('id', uid).single().then(({ data }) => {
      setProfile(data as Profile | null)
      setLoading(false)
    })
  }, [uid])

  return <Ctx.Provider value={{ session, profile, loading }}>{children}</Ctx.Provider>
}
