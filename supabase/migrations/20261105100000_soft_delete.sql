-- Soft delete: tasks and objects are never physically removed through the API,
-- so the status history is preserved. Deleted rows are visible to managers only.

alter table public.objects
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;
alter table public.tasks
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

-- hard DELETE is no longer possible from the API
revoke delete on public.objects, public.tasks from authenticated;
drop policy objects_delete on public.objects;
drop policy tasks_delete on public.tasks;

create or replace function public.has_task_in_object(p_object_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks
    where object_id = p_object_id and assignee_id = auth.uid() and deleted_at is null);
$$;

-- deleted rows: managers can read them, nobody can modify them
drop policy objects_select on public.objects;
create policy objects_select on public.objects for select to authenticated
  using (public.is_manager() or (deleted_at is null and public.has_task_in_object(id)));
drop policy objects_update on public.objects;
create policy objects_update on public.objects for update to authenticated
  using (public.is_manager() and deleted_at is null) with check (public.is_manager());

drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_manager() or (deleted_at is null and assignee_id = auth.uid()));
drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_manager() and deleted_at is null) with check (public.is_manager());

-- guard: no edits of deleted/accepted tasks, no tasks in deleted objects
create or replace function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Assignee must be an executor';
  end if;
  if tg_op = 'INSERT' or new.object_id is distinct from old.object_id then
    if not exists (select 1 from public.objects where id = new.object_id and deleted_at is null) then
      raise exception 'Object not found';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null then
      raise exception 'Deleted task cannot be edited';
    end if;
    if old.status = 'accepted' and new.deleted_at is not distinct from old.deleted_at then
      raise exception 'Accepted task cannot be edited';
    end if;
  end if;
  return new;
end $$;

create or replace function public.delete_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Only a manager can delete tasks'; end if;
  update public.tasks set deleted_at = now(), deleted_by = auth.uid()
  where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Task not found'; end if;
end $$;

-- deleting an object also marks its tasks as deleted (same moment, so they can be told apart)
create or replace function public.delete_object(p_object_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  if not public.is_manager() then raise exception 'Only a manager can delete objects'; end if;
  update public.objects set deleted_at = v_now, deleted_by = auth.uid()
  where id = p_object_id and deleted_at is null;
  if not found then raise exception 'Object not found'; end if;
  update public.tasks set deleted_at = v_now, deleted_by = auth.uid()
  where object_id = p_object_id and deleted_at is null;
end $$;

-- status changes are impossible on deleted tasks
create or replace function public.change_task_status(p_task_id uuid, p_new_status public.task_status, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_manager boolean := public.is_manager();
  v_uid uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into t from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found or not (v_manager or t.assignee_id = v_uid) then
    raise exception 'Task not found';
  end if;

  if (t.status, p_new_status) in (('new','in_progress'), ('in_progress','in_review'), ('needs_rework','in_progress')) then
    if t.assignee_id is distinct from v_uid then
      raise exception 'Only the assigned executor can do this transition';
    end if;
  elsif (t.status, p_new_status) in (('in_review','accepted'), ('in_review','needs_rework')) then
    if not v_manager then
      raise exception 'Only a manager can do this transition';
    end if;
    if p_new_status = 'needs_rework' and v_comment is null then
      raise exception 'Comment is required when returning for rework';
    end if;
  else
    raise exception 'Transition % -> % is not allowed', t.status, p_new_status;
  end if;

  update public.tasks set status = p_new_status where id = t.id;
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
  values (t.id, v_uid, t.status, p_new_status, v_comment);
end $$;

revoke all on function public.delete_task(uuid), public.delete_object(uuid) from public, anon, authenticated;
grant execute on function public.delete_task(uuid), public.delete_object(uuid) to authenticated;
