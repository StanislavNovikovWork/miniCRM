import { Center, Loader } from '@mantine/core'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './lib/auth'
import { Deleted } from './pages/Deleted'
import { Login } from './pages/Login'
import { MyTasks } from './pages/MyTasks'
import { ObjectPage } from './pages/ObjectPage'
import { Objects } from './pages/Objects'
import { TaskPage } from './pages/TaskPage'

export default function App() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Center h="100vh"><Loader /></Center>
  if (!session || !profile) return <Login />
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Objects />} />
          <Route path="objects/:id" element={<ObjectPage />} />
          <Route path="tasks/:id" element={<TaskPage />} />
          {profile.role === 'executor' && <Route path="my" element={<MyTasks />} />}
          {profile.role === 'manager' && <Route path="deleted" element={<Deleted />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
