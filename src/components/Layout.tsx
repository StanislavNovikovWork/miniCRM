import { AppShell, Button, Group, Text } from '@mantine/core'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function Layout() {
  const { profile } = useAuth()
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Text fw={700}>Мини-CRM</Text>
            <Button component={Link} to="/" variant="subtle">Объекты</Button>
            {profile?.role === 'executor' && <Button component={Link} to="/my" variant="subtle">Мои задачи</Button>}
          </Group>
          <Group>
            <Text size="sm">{profile?.full_name || profile?.email} ({profile?.role === 'manager' ? 'постановщик' : 'исполнитель'})</Text>
            <Button size="xs" variant="default" onClick={() => supabase.auth.signOut()}>Выйти</Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main><Outlet /></AppShell.Main>
    </AppShell>
  )
}
