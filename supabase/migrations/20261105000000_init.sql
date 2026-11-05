-- Mini-CRM: objects & tasks. All access rules are enforced here (RLS + functions).

create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'needs_rework');

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'executor'
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  address text not null default '',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  object_id uuid not null references public.objects (id) on delete cascade,
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index tasks_object_idx on public.tasks (object_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  created_at timestamptz not null default now()
);
create index task_history_task_idx on public.task_history (task_id, created_at);

-- ---------- helpers ----------
create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

create function public.has_task_in_object(p_object_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks where object_id = p_object_id and assignee_id = auth.uid());
$$;

-- new auth user -> profile (role defaults to executor; promote managers manually)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- task guards ----------
-- assignee must be an executor; accepted tasks are frozen; creation is logged in history
create function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Assignee must be an executor';
  end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' then
    raise exception 'Accepted task cannot be edited';
  end if;
  return new;
end $$;

create trigger tasks_guard_trg before insert or update on public.tasks
for each row execute function public.tasks_guard();

create function public.tasks_log_create() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.task_history (task_id, changed_by, from_status, to_status)
  values (new.id, new.author_id, null, 'new');
  return new;
end $$;

create trigger tasks_log_create_trg after insert on public.tasks
for each row execute function public.tasks_log_create();

-- ---------- status transitions (the only way to change status) ----------
create function public.change_task_status(p_task_id uuid, p_new_status public.task_status, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_manager boolean := public.is_manager();
  v_uid uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into t from public.tasks where id = p_task_id for update;
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

-- ---------- privileges ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.objects, public.tasks, public.task_history to authenticated;
grant insert (name, address) on public.objects to authenticated;
grant update (name, address) on public.objects to authenticated;
grant delete on public.objects to authenticated;
grant insert (title, description, object_id, assignee_id) on public.tasks to authenticated;
grant update (title, description, object_id, assignee_id) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.has_task_in_object(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or role = 'manager' or public.is_manager());

create policy objects_select on public.objects for select to authenticated
  using (public.is_manager() or public.has_task_in_object(id));
create policy objects_insert on public.objects for insert to authenticated
  with check (public.is_manager());
create policy objects_update on public.objects for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy objects_delete on public.objects for delete to authenticated
  using (public.is_manager());

create policy tasks_select on public.tasks for select to authenticated
  using (public.is_manager() or assignee_id = auth.uid());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_manager() and status = 'new' and author_id = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_manager());

-- history: read-only for clients, written only by trigger / change_task_status
create policy history_select on public.task_history for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()));
