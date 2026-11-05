import { Table, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import type { Profile, Task } from '../lib/types'
import { fmtDate } from '../lib/types'
import { StatusBadge } from './StatusBadge'

export function TasksTable({ tasks, profiles, objectNames, onOpen }: {
  tasks: Task[]; profiles: Profile[]; objectNames?: Record<string, string>; onOpen: (id: string) => void
}) {
  if (!tasks.length) return <Text c="dimmed">Задач нет</Text>
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.full_name || '—'
  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Задача</Table.Th>
          {objectNames && <Table.Th>Объект</Table.Th>}
          <Table.Th>Исполнитель</Table.Th>
          <Table.Th>Статус</Table.Th>
          <Table.Th>Создана</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tasks.map((t) => (
          <Table.Tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(t.id)}>
            <Table.Td><Link to={`/tasks/${t.id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(t.id) }}>{t.title}</Link></Table.Td>
            {objectNames && <Table.Td>{objectNames[t.object_id]}</Table.Td>}
            <Table.Td>{name(t.assignee_id)}</Table.Td>
            <Table.Td><StatusBadge status={t.status} /></Table.Td>
            <Table.Td>{fmtDate(t.created_at)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
