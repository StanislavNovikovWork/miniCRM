import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setError(error ? 'Неверный email или пароль' : '')
    setBusy(false)
  }

  return (
    <Center h="100vh">
      <Paper withBorder p="xl" w={360} component="form" onSubmit={submit}>
        <Stack>
          <Title order={3}>Вход</Title>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Email" type="email" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <PasswordInput label="Пароль" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
          <Button type="submit" loading={busy}>Войти</Button>
        </Stack>
      </Paper>
    </Center>
  )
}
