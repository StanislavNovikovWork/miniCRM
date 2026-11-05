import { Button, Group, Loader, Modal, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { showError, useLoad } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { CrmObject } from '../lib/types'

export function Objects() {
  const { profile } = useAuth()
  const { data, loading, reload } = useLoad<CrmObject[]>(() =>
    supabase.from('objects').select('*').order('created_at', { ascending: false }))
  const [opened, { open, close }] = useDisclosure()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('objects').insert({ name, address })
    if (error) return showError(error.message)
    setName(''); setAddress(''); close(); reload()
  }

  if (loading) return <Loader />
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Объекты</Title>
        {profile?.role === 'manager' && <Button onClick={open}>Создать объект</Button>}
      </Group>
      {data?.length ? (
        <Table highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Название</Table.Th><Table.Th>Адрес</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td><Link to={`/objects/${o.id}`}>{o.name}</Link></Table.Td>
                <Table.Td>{o.address}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : <Text c="dimmed">Объектов нет</Text>}
      <Modal opened={opened} onClose={close} title="Новый объект">
        <form onSubmit={create}>
          <Stack>
            <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <TextInput label="Адрес" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
            <Button type="submit">Создать</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
