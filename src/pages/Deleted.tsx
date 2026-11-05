import { Button, Drawer, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { TaskDetails } from '../components/TaskDetails'
import { StatusBadge } from '../components/StatusBadge'
import { showError, useLoad, useProfiles } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { fmtDate, type CrmObject, type Task } from '../lib/types'

export function Deleted() {
  const profiles = useProfiles()
  const [openId, setOpenId] = useState<string | null>(null)
  const tasks = useLoad<Task[]>(() => supabase.from('tasks').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }))
  const allObjects = useLoad<CrmObject[]>(() => supabase.from('objects').select('*'))
  if (tasks.loading || allObjects.loading) return <Loader />
  const deletedObjects = (allObjects.data ?? []).filter((o) => o.deleted_at).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!))
  const reload = () => { tasks.reload(); allObjects.reload() }
  const restoreObject = async (id: string) => {
    const { error } = await supabase.rpc('restore_object', { p_object_id: id })
    if (error) return showError(error.message)
    reload()
  }
  const who = (id: string | null) => profiles.find((p) => p.id === id)?.full_name || '—'
  const objName = (id: string) => allObjects.data?.find((o) => o.id === id)?.name ?? '—'

  return (
    <Stack>
      <Title order={2}>Удалённые</Title>
      <Title order={4}>Объекты</Title>
      {deletedObjects.length ? (
        <Table>
          <Table.Thead><Table.Tr><Table.Th>Название</Table.Th><Table.Th>Адрес</Table.Th><Table.Th>Удалил</Table.Th><Table.Th>Когда</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {deletedObjects.map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td>{o.name}</Table.Td><Table.Td>{o.address}</Table.Td>
                <Table.Td>{who(o.deleted_by)}</Table.Td><Table.Td>{fmtDate(o.deleted_at!)}</Table.Td>
                <Table.Td><Button size="xs" variant="light" color="green" onClick={() => restoreObject(o.id)}>Восстановить</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : <Text c="dimmed">Нет удалённых объектов</Text>}
      <Title order={4}>Задачи</Title>
      {tasks.data?.length ? (
        <Table highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Задача</Table.Th><Table.Th>Объект</Table.Th><Table.Th>Статус</Table.Th><Table.Th>Удалил</Table.Th><Table.Th>Когда</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {tasks.data.map((t) => (
              <Table.Tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(t.id)}>
                <Table.Td>{t.title}</Table.Td>
                <Table.Td>{objName(t.object_id)}</Table.Td>
                <Table.Td><StatusBadge status={t.status} /></Table.Td>
                <Table.Td>{who(t.deleted_by)}</Table.Td><Table.Td>{fmtDate(t.deleted_at!)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : <Text c="dimmed">Нет удалённых задач</Text>}
      <Drawer opened={!!openId} onClose={() => setOpenId(null)} position="right" size="lg" title="Задача">
        {openId && <TaskDetails key={openId} id={openId} onChanged={reload} />}
      </Drawer>
    </Stack>
  )
}
