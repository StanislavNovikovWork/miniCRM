import { useParams } from 'react-router-dom'
import { TaskDetails } from '../components/TaskDetails'

export const TaskPage = () => <TaskDetails key={useParams().id} id={useParams().id!} />
