import { Loader, Stack, Title } from '@mantine/core'
import { TasksTable } from '../components/TasksTable'
import { useAuth } from '../lib/auth'
import { useLoad, useProfiles } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { CrmObject, Task } from '../lib/types'

export function MyTasks() {
  const { profile } = useAuth()
  const profiles = useProfiles()
  const tasks = useLoad<Task[]>(() =>
    supabase.from('tasks').select('*').eq('assignee_id', profile!.id).order('created_at', { ascending: false }))
  const objects = useLoad<CrmObject[]>(() => supabase.from('objects').select('*'))
  if (tasks.loading || objects.loading) return <Loader />
  const names = Object.fromEntries((objects.data ?? []).map((o) => [o.id, o.name]))
  return (
    <Stack>
      <Title order={2}>Мои задачи</Title>
      <TasksTable tasks={tasks.data ?? []} profiles={profiles} objectNames={names} />
    </Stack>
  )
}
