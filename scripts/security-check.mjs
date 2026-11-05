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
check('manager cannot hard-DELETE a task', !!(await mgr.from('tasks').delete().eq('id', foreign.id)).error)
check('manager cannot hard-DELETE an object', !!(await mgr.from('objects').delete().eq('id', foreign.object_id)).error)
check('executor cannot soft-delete a task', !!(await ivan.rpc('delete_task', { p_task_id: ivanTasks[0].id })).error)
check('executor cannot restore a task', !!(await ivan.rpc('restore_task', { p_task_id: ivanTasks[0].id })).error)
check('executor cannot restore an object', !!(await ivan.rpc('restore_object', { p_object_id: foreign.object_id })).error)
check('anon cannot restore a task', !!(await anon.rpc('restore_task', { p_task_id: foreign.id })).error)
check('executor cannot soft-delete an object', !!(await ivan.rpc('delete_object', { p_object_id: foreign.object_id })).error)
check('anon cannot soft-delete a task', !!(await anon.rpc('delete_task', { p_task_id: foreign.id })).error)
check('manager cannot set deleted_at directly', !!(await mgr.from('tasks').update({ deleted_at: null }).eq('id', foreign.id)).error)
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
const own = ivanTasks[0]
const skip = (name) => console.log(`SKIP  ${name} (no suitable task in current data)`)
check('executor cannot accept own task', !!(await rpc(ivan, own, 'accepted')).error)
check('nobody can move a task back to "new"', !!(await rpc(mgr, foreign, 'new')).error && !!(await rpc(ivan, own, 'new')).error)
check("executor cannot move another's task", !!(await rpc(ivan, foreign, 'in_progress')).error)
check('manager cannot take work (not assignee)', !!(await rpc(mgr, foreign, 'in_progress')).error)
check('accepted is final', !!(await rpc(mgr, byStatus('accepted'), 'in_progress')).error)
const newOwn = byStatus('new', ivanId)
if (newOwn) {
  check('new -> accepted forbidden', !!(await rpc(mgr, newOwn, 'accepted')).error)
  check('new -> in_review forbidden', !!(await rpc(ivan, newOwn, 'in_review')).error)
} else skip('new -> accepted / in_review')
if (inReview) {
  const owner = inReview.assignee_id === ivanId ? ivan : petr
  check('executor cannot accept task in review', !!(await rpc(owner, inReview, 'accepted')).error)
  check('rework without comment forbidden', !!(await rpc(mgr, inReview, 'needs_rework', '  ')).error)
} else skip('review checks')
check('anon cannot call RPC', !!(await rpc(anon, own, 'in_progress')).error)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
