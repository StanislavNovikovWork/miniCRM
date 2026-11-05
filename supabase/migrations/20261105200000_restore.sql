-- Restore of soft-deleted tasks and objects (managers only).

-- the guard must let the restore through (deleted_at -> null) but still freeze deleted tasks
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
    if old.deleted_at is not null and new.deleted_at is not null then
      raise exception 'Deleted task cannot be edited';
    end if;
    if old.status = 'accepted' and new.deleted_at is not distinct from old.deleted_at then
      raise exception 'Accepted task cannot be edited';
    end if;
  end if;
  return new;
end $$;

create function public.restore_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Only a manager can restore tasks'; end if;
  if exists (select 1 from public.tasks t join public.objects o on o.id = t.object_id
             where t.id = p_task_id and o.deleted_at is not null) then
    raise exception 'Restore the object first';
  end if;
  update public.tasks set deleted_at = null, deleted_by = null
  where id = p_task_id and deleted_at is not null;
  if not found then raise exception 'Task not found'; end if;
end $$;

-- restores the object and the tasks that were deleted together with it
create function public.restore_object(p_object_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  if not public.is_manager() then raise exception 'Only a manager can restore objects'; end if;
  select deleted_at into v_at from public.objects where id = p_object_id and deleted_at is not null;
  if not found then raise exception 'Object not found'; end if;
  update public.objects set deleted_at = null, deleted_by = null where id = p_object_id;
  update public.tasks set deleted_at = null, deleted_by = null
  where object_id = p_object_id and deleted_at = v_at;
end $$;

revoke all on function public.restore_task(uuid), public.restore_object(uuid) from public, anon, authenticated;
grant execute on function public.restore_task(uuid), public.restore_object(uuid) to authenticated;
