import { Drawer, SegmentedControl, Stack } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { useState } from 'react'
import type { Profile, Task } from '../lib/types'
import { Board } from './Board'
import { TaskDetails } from './TaskDetails'
import { TasksTable } from './TasksTable'

export function TasksView(props: { tasks: Task[]; profiles: Profile[]; objectNames?: Record<string, string>; onChanged: () => void }) {
  const [view, setView] = useLocalStorage<'board' | 'list'>({ key: 'tasks-view', defaultValue: 'board' })
  const [openId, setOpenId] = useState<string | null>(null)
  const common = { ...props, onOpen: setOpenId }
  return (
    <Stack>
      <SegmentedControl w={200} value={view} onChange={(v) => setView(v as 'board' | 'list')}
        data={[{ value: 'board', label: 'Доска' }, { value: 'list', label: 'Список' }]} />
      {view === 'board' ? <Board {...common} /> : <TasksTable {...common} />}
      <Drawer opened={!!openId} onClose={() => setOpenId(null)} position="right" size="lg" title="Задача">
        {openId && <TaskDetails key={openId} id={openId} onChanged={props.onChanged} onDeleted={() => { setOpenId(null); props.onChanged() }} />}
      </Drawer>
    </Stack>
  )
}
