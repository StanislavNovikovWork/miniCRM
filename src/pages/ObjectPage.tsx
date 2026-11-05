import { Button, Group, Loader, Modal, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import { useAuth } from '../lib/auth'
import { showError, useLoad, useProfiles } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { CrmObject, Task } from '../lib/types'

export function ObjectPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const profiles = useProfiles()
  const isManager = profile?.role === 'manager'
  const obj = useLoad<CrmObject>(() => supabase.from('objects').select('*').eq('id', id!).maybeSingle())
  const tasks = useLoad<Task[]>(() =>
    supabase.from('tasks').select('*').eq('object_id', id!).order('created_at', { ascending: false }))
  const [taskModal, taskCtl] = useDisclosure()
  const [editModal, editCtl] = useDisclosure()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  if (obj.loading || tasks.loading) return <Loader />
  if (!obj.data) return <Text>Объект не найден</Text>

  const executors = profiles.filter((p) => p.role === 'executor').map((p) => ({ value: p.id, label: p.full_name || p.email }))

  const createTask = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('tasks').insert({ title, description, object_id: id!, assignee_id: assignee })
    if (error) return showError(error.message)
    setTitle(''); setDescription(''); setAssignee(null); taskCtl.close(); tasks.reload()
  }
  const saveObject = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('objects').update({ name, address }).eq('id', id!)
    if (error) return showError(error.message)
    editCtl.close(); obj.reload()
  }
  const remove = async () => {
    if (!confirm('Удалить объект вместе со всеми задачами?')) return
    const { error } = await supabase.from('objects').delete().eq('id', id!)
    if (error) return showError(error.message)
    nav('/')
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>{obj.data.name}</Title>
          <Text c="dimmed">{obj.data.address}</Text>
        </div>
        {isManager && (
          <Group>
            <Button variant="default" onClick={() => { setName(obj.data!.name); setAddress(obj.data!.address); editCtl.open() }}>Редактировать</Button>
            <Button color="red" variant="light" onClick={remove}>Удалить</Button>
            <Button onClick={taskCtl.open}>Создать задачу</Button>
          </Group>
        )}
      </Group>
      <Title order={4}>Задачи</Title>
      <TasksTable tasks={tasks.data ?? []} profiles={profiles} />
      <Modal opened={taskModal} onClose={taskCtl.close} title="Новая задача">
        <form onSubmit={createTask}>
          <Stack>
            <TextInput label="Название" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            <Textarea label="Описание" autosize minRows={3} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
            <Select label="Исполнитель" data={executors} value={assignee} onChange={setAssignee} clearable />
            <Button type="submit">Создать</Button>
          </Stack>
        </form>
      </Modal>
      <Modal opened={editModal} onClose={editCtl.close} title="Редактировать объект">
        <form onSubmit={saveObject}>
          <Stack>
            <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <TextInput label="Адрес" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
            <Button type="submit">Сохранить</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
