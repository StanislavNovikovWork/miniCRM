import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

export const showError = (message: string) =>
  notifications.show({ color: 'red', title: 'Ошибка', message })

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])
  return profiles
}

export function useLoad<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const res = await fn()
    if (res.error) showError(res.error.message)
    setData(res.data)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}
