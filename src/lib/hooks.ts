import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { STATUS_LABEL, type Profile, type Status } from './types'

const ERRORS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/Not authenticated/i, 'Вы не авторизованы. Войдите заново'],
  [/Task not found/i, 'Задача не найдена или недоступна'],
  [/Object not found/i, 'Объект не найден или удалён'],
  [/Restore the object first/i, 'Сначала восстановите объект, к которому относится задача'],
  [/Only the assigned executor/i, 'Этот переход может выполнить только назначенный исполнитель'],
  [/Only a manager/i, 'Это действие доступно только постановщику'],
  [/Comment is required/i, 'При возврате на доработку нужен комментарий'],
  [/Transition (\w+) -> (\w+) is not allowed/i, (m) => `Переход «${STATUS_LABEL[m[1] as Status] ?? m[1]}» → «${STATUS_LABEL[m[2] as Status] ?? m[2]}» запрещён`],
  [/Assignee must be an executor/i, 'Исполнителем может быть только пользователь с ролью «исполнитель»'],
  [/Accepted task cannot be edited/i, 'Принятую задачу нельзя редактировать'],
  [/Deleted task cannot be edited/i, 'Удалённую задачу нельзя редактировать. Сначала восстановите её'],
  [/permission denied|row-level security|violates/i, 'Недостаточно прав для этого действия'],
  [/Failed to fetch|NetworkError/i, 'Нет связи с сервером. Проверьте интернет'],
]

export const translateError = (message: string) => {
  for (const [re, text] of ERRORS) {
    const m = message.match(re)
    if (m) return typeof text === 'function' ? text(m) : text
  }
  return `Не удалось выполнить действие: ${message}`
}

export const showError = (message: string) =>
  notifications.show({ color: 'red', title: 'Ошибка', message: translateError(message) })

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
