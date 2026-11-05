export type Role = 'manager' | 'executor'
export type Status = 'new' | 'in_progress' | 'in_review' | 'accepted' | 'needs_rework'

export interface Profile { id: string; email: string; full_name: string; role: Role }
export interface CrmObject { id: string; name: string; address: string }
export interface Task {
  id: string
  title: string
  description: string
  object_id: string
  assignee_id: string | null
  status: Status
  author_id: string
  created_at: string
}
export interface HistoryItem {
  id: number
  task_id: string
  changed_by: string | null
  from_status: Status | null
  to_status: Status
  comment: string | null
  created_at: string
}

export const STATUS_LABEL: Record<Status, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принята',
  needs_rework: 'На доработке',
}
export const STATUS_COLOR: Record<Status, string> = {
  new: 'gray',
  in_progress: 'blue',
  in_review: 'yellow',
  accepted: 'green',
  needs_rework: 'red',
}

export interface Action { to: Status; label: string; color: string; commentRequired?: boolean }

// UI hint only: the database enforces the same rules in change_task_status()
export function availableActions(task: Task, profile: Profile): Action[] {
  const mine = task.assignee_id === profile.id
  const mgr = profile.role === 'manager'
  switch (task.status) {
    case 'new': return mine ? [{ to: 'in_progress', label: 'Взять в работу', color: 'blue' }] : []
    case 'in_progress': return mine ? [{ to: 'in_review', label: 'Отправить на проверку', color: 'yellow' }] : []
    case 'needs_rework': return mine ? [{ to: 'in_progress', label: 'Взять в работу', color: 'blue' }] : []
    case 'in_review': return mgr ? [
      { to: 'accepted', label: 'Принять', color: 'green' },
      { to: 'needs_rework', label: 'Вернуть на доработку', color: 'red', commentRequired: true },
    ] : []
    default: return []
  }
}

export const fmtDate = (s: string) => new Date(s).toLocaleString('ru-RU')
