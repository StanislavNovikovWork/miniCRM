import { Alert, Button, Card, Group, Loader, Modal, Select, Stack, Text, TextInput, Textarea, Timeline, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import { useAuth } from '../lib/auth'
import { showError, useLoad, useProfiles } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { availableActions, fmtDate, STATUS_LABEL, type Action, type CrmObject, type HistoryItem, type Task } from '../lib/types'

export function TaskDetails({ id, onChanged, onDeleted }: { id: string; onChanged?: () => void; onDeleted?: () => void }) {
  const nav = useNavigate()
  const { profile } = useAuth()
  const profiles = useProfiles()
  const task = useLoad<Task>(() => supabase.from('tasks').select('*').eq('id', id).maybeSingle())
  const history = useLoad<HistoryItem[]>(() =>
    supabase.from('task_history').select('*').eq('task_id', id).order('id'))
  const obj = useLoad<CrmObject>(async () => {
    const { data: t } = await supabase.from('tasks').select('object_id').eq('id', id).maybeSingle()
    return supabase.from('objects').select('*').eq('id', t?.object_id ?? '').maybeSingle()
  })
  const [pending, setPending] = useState<Action | null>(null)
  const [comment, setComment] = useState('')
  const [editOpen, editCtl] = useDisclosure()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState<string | null>(null)

  if (task.loading || history.loading || obj.loading || !profile) return <Loader />
  const t = task.data
  if (!t) return <Text>Задача не найдена</Text>

  const isManager = profile.role === 'manager'
  const pname = (pid: string | null) => profiles.find((p) => p.id === pid)?.full_name || '—'
  const executors = profiles.filter((p) => p.role === 'executor').map((p) => ({ value: p.id, label: p.full_name || p.email }))
  const reloadAll = () => { task.reload(); history.reload(); onChanged?.() }

  const doChange = async (to: Action['to'], text: string) => {
    const { error } = await supabase.rpc('change_task_status', { p_task_id: t.id, p_new_status: to, p_comment: text || null })
    if (error) return showError(error.message)
    setPending(null); setComment(''); reloadAll()
  }
  const onAction = (a: Action) => (a.commentRequired ? (setComment(''), setPending(a)) : doChange(a.to, ''))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('tasks').update({ title, description, assignee_id: assignee }).eq('id', t.id)
    if (error) return showError(error.message)
    editCtl.close(); task.reload(); onChanged?.()
  }
  const restore = async () => {
    const { error } = await supabase.rpc('restore_task', { p_task_id: t.id })
    if (error) return showError(error.message)
    notifications.show({ color: 'green', message: 'Задача восстановлена' })
    reloadAll()
  }
  const remove = () => modals.openConfirmModal({
    title: 'Удалить задачу?',
    children: <Text size="sm">Её можно будет посмотреть в разделе «Удалённые».</Text>,
    labels: { confirm: 'Удалить', cancel: 'Отмена' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      const { error } = await supabase.rpc('delete_task', { p_task_id: t.id })
      if (error) return showError(error.message)
      if (onDeleted) onDeleted()
      else nav(`/objects/${t.object_id}`)
    },
  })

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>{t.title}</Title>
        <StatusBadge status={t.status} />
      </Group>
      {t.deleted_at && <Alert color="red">Задача удалена {fmtDate(t.deleted_at)} ({pname(t.deleted_by)}). Доступна только для просмотра.</Alert>}
      <Card withBorder>
        <Stack gap="xs">
          <Text>Объект: <Link to={`/objects/${t.object_id}`}>{obj.data?.name ?? '—'}</Link></Text>
          <Text>Исполнитель: {pname(t.assignee_id)}</Text>
          <Text>Автор: {pname(t.author_id)}</Text>
          <Text>Создана: {fmtDate(t.created_at)}</Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{t.description || 'Без описания'}</Text>
        </Stack>
      </Card>
      <Group>
        {availableActions(t, profile).map((a) => (
          <Button key={a.to} color={a.color} onClick={() => onAction(a)}>{a.label}</Button>
        ))}
        {isManager && !t.deleted_at && t.status !== 'accepted' && (
          <Button variant="default" onClick={() => { setTitle(t.title); setDescription(t.description); setAssignee(t.assignee_id); editCtl.open() }}>Редактировать</Button>
        )}
        {isManager && t.deleted_at && <Button color="green" onClick={restore}>Восстановить</Button>}
        {isManager && !t.deleted_at && <Button color="red" variant="light" onClick={remove}>Удалить</Button>}
      </Group>
      <Title order={4}>История</Title>
      <Timeline bulletSize={14} active={(history.data?.length ?? 1) - 1}>
        {history.data?.map((h) => (
          <Timeline.Item key={h.id} title={h.from_status ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}` : `Создана (${STATUS_LABEL[h.to_status]})`}>
            <Text size="sm">{pname(h.changed_by)}, {fmtDate(h.created_at)}</Text>
            {h.comment && <Text size="sm" c="dimmed">Комментарий: {h.comment}</Text>}
          </Timeline.Item>
        ))}
      </Timeline>
      <Modal opened={!!pending} onClose={() => setPending(null)} title={pending?.label}>
        <Stack>
          <Textarea label="Комментарий" required autosize minRows={3} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Button color={pending?.color} disabled={!comment.trim()} onClick={() => pending && doChange(pending.to, comment)}>Подтвердить</Button>
        </Stack>
      </Modal>
      <Modal opened={editOpen} onClose={editCtl.close} title="Редактировать задачу">
        <form onSubmit={save}>
          <Stack>
            <TextInput label="Название" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            <Textarea label="Описание" autosize minRows={3} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
            <Select label="Исполнитель" data={executors} value={assignee} onChange={setAssignee} clearable />
            <Button type="submit">Сохранить</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
