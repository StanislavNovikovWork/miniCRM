import { Badge, Button, Card, Group, Modal, ScrollArea, Stack, Text, Textarea } from '@mantine/core'
import { useState, type DragEvent } from 'react'
import { useAuth } from '../lib/auth'
import { showError } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { availableActions, STATUS_COLOR, STATUS_LABEL, type Action, type Profile, type Status, type Task } from '../lib/types'

const COLUMNS: Status[] = ['new', 'in_progress', 'in_review', 'needs_rework', 'accepted']

export async function changeStatus(taskId: string, to: Status, comment?: string) {
  const { error } = await supabase.rpc('change_task_status', { p_task_id: taskId, p_new_status: to, p_comment: comment || null })
  if (error) showError(error.message)
  return !error
}

export function Board({ tasks, profiles, objectNames, onChanged, onOpen }: {
  tasks: Task[]; profiles: Profile[]; objectNames?: Record<string, string>; onChanged: () => void; onOpen: (id: string) => void
}) {
  const { profile } = useAuth()
  const [dragged, setDragged] = useState<Task | null>(null)
  const [over, setOver] = useState<Status | null>(null)
  const [pending, setPending] = useState<{ task: Task; action: Action } | null>(null)
  const [comment, setComment] = useState('')
  if (!profile) return null

  const actionFor = (t: Task | null, to: Status) => t ? availableActions(t, profile).find((a) => a.to === to) : undefined
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.full_name || 'Без исполнителя'

  const drop = async (e: DragEvent, to: Status) => {
    e.preventDefault()
    const task = dragged
    setDragged(null); setOver(null)
    if (!task || task.status === to) return
    const action = actionFor(task, to)
    if (!action) return showError(`Переход «${STATUS_LABEL[task.status]}» → «${STATUS_LABEL[to]}» недоступен`)
    if (action.commentRequired) { setComment(''); return setPending({ task, action }) }
    if (await changeStatus(task.id, to)) onChanged()
  }

  const confirm = async () => {
    if (!pending) return
    if (await changeStatus(pending.task.id, pending.action.to, comment)) { setPending(null); onChanged() }
  }

  return (
    <>
      <ScrollArea>
        <Group align="stretch" wrap="nowrap" gap="sm" pb="sm">
          {COLUMNS.map((status) => {
            const droppable = !!actionFor(dragged, status)
            return (
              <Card
                key={status} withBorder w={260} miw={260} bg="gray.0"
                style={{ outline: dragged && droppable ? '2px dashed var(--mantine-color-blue-5)' : undefined, opacity: dragged && !droppable && dragged.status !== status ? 0.5 : 1 }}
                onDragOver={(e) => { if (droppable) { e.preventDefault(); setOver(status) } }}
                onDragLeave={() => setOver((o) => (o === status ? null : o))}
                onDrop={(e) => drop(e, status)}
              >
                <Group justify="space-between" mb="xs">
                  <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                  <Text size="sm" c="dimmed">{tasks.filter((t) => t.status === status).length}</Text>
                </Group>
                <Stack gap="xs" mih={80} bg={over === status ? 'blue.0' : undefined}>
                  {tasks.filter((t) => t.status === status).map((t) => {
                    const movable = availableActions(t, profile).length > 0
                    return (
                      <Card
                        key={t.id} withBorder padding="xs" draggable={movable}
                        style={{ cursor: movable ? 'grab' : 'pointer' }} onClick={() => onOpen(t.id)}
                        onDragStart={() => setDragged(t)} onDragEnd={() => { setDragged(null); setOver(null) }}
                      >
                        <Text fw={500} size="sm">{t.title}</Text>
                        {objectNames && <Text size="xs" c="dimmed">{objectNames[t.object_id]}</Text>}
                        <Text size="xs" c="dimmed">{name(t.assignee_id)}</Text>
                      </Card>
                    )
                  })}
                </Stack>
              </Card>
            )
          })}
        </Group>
      </ScrollArea>
      <Modal opened={!!pending} onClose={() => setPending(null)} title={pending?.action.label}>
        <Stack>
          <Textarea label="Комментарий" required autosize minRows={3} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Button color={pending?.action.color} disabled={!comment.trim()} onClick={confirm}>Подтвердить</Button>
        </Stack>
      </Modal>
    </>
  )
}
