-- Demo data. Run in the Supabase SQL Editor AFTER creating three users in Auth -> Users:
--   manager@example.com, ivan@example.com, petr@example.com
-- (rename emails below if you used different ones). Safe to run once.

insert into public.profiles (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

update public.profiles set role = 'manager', full_name = 'Анна Руководителева' where email = 'manager@example.com';
update public.profiles set full_name = 'Иван Исполнителев' where email = 'ivan@example.com';
update public.profiles set full_name = 'Пётр Строителев' where email = 'petr@example.com';

do $$
declare
  m uuid := (select id from public.profiles where email = 'manager@example.com');
  i uuid := (select id from public.profiles where email = 'ivan@example.com');
  p uuid := (select id from public.profiles where email = 'petr@example.com');
  o1 uuid; o2 uuid; o3 uuid; t uuid;
begin
  insert into public.objects (name, address, created_by) values ('ЖК «Северный»', 'г. Москва, ул. Северная, 12', m) returning id into o1;
  insert into public.objects (name, address, created_by) values ('Склад на Заводской', 'г. Тверь, ул. Заводская, 5', m) returning id into o2;
  insert into public.objects (name, address, created_by) values ('Коттедж Озёрный', 'Московская обл., пос. Озёрный, уч. 7', m) returning id into o3;

  insert into public.tasks (title, description, object_id, assignee_id, author_id) values ('Залить фундамент', 'Секция А, до пятницы', o1, i, m);

  insert into public.tasks (title, description, object_id, assignee_id, author_id) values ('Монтаж арматуры', 'Секция Б', o1, i, m) returning id into t;
  update public.tasks set status = 'in_progress' where id = t;
  insert into public.task_history (task_id, changed_by, from_status, to_status) values (t, i, 'new', 'in_progress');

  insert into public.tasks (title, description, object_id, assignee_id, author_id) values ('Электропроводка 1 этажа', '', o2, p, m) returning id into t;
  update public.tasks set status = 'in_review' where id = t;
  insert into public.task_history (task_id, changed_by, from_status, to_status) values
    (t, p, 'new', 'in_progress'), (t, p, 'in_progress', 'in_review');

  insert into public.tasks (title, description, object_id, assignee_id, author_id) values ('Кровля', 'Металлочерепица', o3, p, m) returning id into t;
  update public.tasks set status = 'needs_rework' where id = t;
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment) values
    (t, p, 'new', 'in_progress', null), (t, p, 'in_progress', 'in_review', null),
    (t, m, 'in_review', 'needs_rework', 'Не закрыт конёк, переделать');

  insert into public.tasks (title, description, object_id, assignee_id, author_id) values ('Штукатурка стен', '', o3, i, m) returning id into t;
  update public.tasks set status = 'accepted' where id = t;
  insert into public.task_history (task_id, changed_by, from_status, to_status) values
    (t, i, 'new', 'in_progress'), (t, i, 'in_progress', 'in_review'), (t, m, 'in_review', 'accepted');

  insert into public.tasks (title, description, object_id, author_id) values ('Закупить материалы (без исполнителя)', '', o2, m);
end $$;
