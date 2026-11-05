// Direct-API security check (bypasses the UI). Usage:
//   DEMO_PASSWORD=... node --env-file=.env scripts/security-check.mjs
// Assumes the demo users from supabase/seed_demo.sql, all with the same password.
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, DEMO_PASSWORD: password } = process.env
let failed = 0
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }

async function login(email) {
  const c = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}
const [mgr, ivan, petr] = await Promise.all(['manager', 'ivan', 'petr'].map((n) => login(`${n}@example.com`)))
const anon = createClient(url, key)

const all = (await mgr.from('tasks').select('*')).data
const byStatus = (s, who) => all.find((t) => t.status === s && (!who || t.assignee_id === who))
const ivanId = (await ivan.auth.getUser()).data.user.id
const petrId = (await petr.auth.getUser()).data.user.id

const ivanTasks = (await ivan.from('tasks').select('*')).data
check('executor sees only own tasks', ivanTasks.length > 0 && ivanTasks.every((t) => t.assignee_id === ivanId))
check('manager sees all tasks', all.length > ivanTasks.length)
check('anon sees nothing', ((await anon.from('tasks').select('*')).data ?? []).length === 0)
const foreign = all.find((t) => t.assignee_id === petrId)
check("executor cannot read another's task by id", (await ivan.from('tasks').select('*').eq('id', foreign.id)).data.length === 0)
check('executor sees only objects with own tasks', (await ivan.from('objects').select('id')).data.length < (await mgr.from('objects').select('id')).data.length)

check('executor cannot UPDATE status directly', !!(await ivan.from('tasks').update({ status: 'accepted' }).eq('id', ivanTasks[0].id)).error)
check("executor cannot edit another's task", !(await ivan.from('tasks').update({ title: 'x' }).eq('id', foreign.id).select()).data?.length)
check('executor cannot delete tasks', !(await ivan.from('tasks').delete().eq('id', ivanTasks[0].id).select()).data?.length)
check('executor cannot create tasks', !!(await ivan.from('tasks').insert({ title: 'x', object_id: foreign.object_id })).error)
check('executor cannot create objects', !!(await ivan.from('objects').insert({ name: 'x' })).error)
check('manager cannot UPDATE status directly', !!(await mgr.from('tasks').update({ status: 'accepted' }).eq('id', foreign.id)).error)
check('manager cannot forge author_id', !!(await mgr.from('tasks').insert({ title: 'x', object_id: foreign.object_id, author_id: petrId })).error)

const hist = (await ivan.from('task_history').select('*')).data
check('executor sees history of own tasks only', hist.length > 0)
check('history INSERT forbidden', !!(await ivan.from('task_history').insert({ task_id: ivanTasks[0].id, to_status: 'accepted' })).error)
check('history INSERT forbidden for manager', !!(await mgr.from('task_history').insert({ task_id: foreign.id, to_status: 'accepted' })).error)
check('history UPDATE has no effect', !(await mgr.from('task_history').update({ comment: 'x' }).eq('id', hist[0].id).select()).data?.length)
check('history DELETE has no effect', !(await mgr.from('task_history').delete().eq('id', hist[0].id).select()).data?.length)
check('role cannot be changed', !(await ivan.from('profiles').update({ role: 'manager' }).eq('id', ivanId).select()).data?.length)

const rpc = (c, t, s, comment) => c.rpc('change_task_status', { p_task_id: t.id, p_new_status: s, p_comment: comment })
const inReview = byStatus('in_review')
const newOwn = byStatus('new', ivanId)
check('executor cannot accept', !!(await rpc(petr, inReview, 'accepted')).error)
check('new -> accepted forbidden', !!(await rpc(mgr, newOwn, 'accepted')).error)
check('new -> in_review forbidden', !!(await rpc(ivan, newOwn, 'in_review')).error)
check("executor cannot move another's task", !!(await rpc(ivan, byStatus('new') && foreign, 'in_progress')).error)
check('manager cannot take work (not assignee)', !!(await rpc(mgr, newOwn, 'in_progress')).error)
check('rework without comment forbidden', !!(await rpc(mgr, inReview, 'needs_rework', '  ')).error)
check('accepted is final', !!(await rpc(mgr, byStatus('accepted'), 'in_progress')).error)
check('anon cannot call RPC', !!(await rpc(anon, newOwn, 'in_progress')).error)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
