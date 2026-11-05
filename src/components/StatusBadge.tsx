import { Badge } from '@mantine/core'
import { STATUS_COLOR, STATUS_LABEL, type Status } from '../lib/types'

export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
)
