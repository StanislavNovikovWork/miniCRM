# Мини-CRM «Объекты и задачи»

React + TypeScript (Vite), Mantine, Supabase (Postgres + Auth + RLS). Деплой: Vercel.

## Запуск

```bash
npm install
cp .env.example .env        # впишите URL проекта и publishable (anon) ключ
npm run dev
```

В `.env` нужны только `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`. Ключ `service_role`/`sb_secret_` во фронтенде и в репозитории не используется.

## База данных

1. Создайте проект в Supabase. В Auth → Sign In / Providers отключите «Allow new users to sign up».
2. Создайте пользователей вручную (Auth → Users, Auto Confirm): `manager@example.com`, `ivan@example.com`, `petr@example.com`.
3. Примените миграции: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push --remote`
   (или вставьте `supabase/migrations/*.sql` в SQL Editor).
4. Демо-данные и роли: выполните `supabase/seed_demo.sql` (делает `manager@example.com` постановщиком, остальные остаются исполнителями).

Новый пользователь по умолчанию получает роль «исполнитель». Постановщика назначают вручную: `update public.profiles set role = 'manager' where email = '...'`.

## Деплой на Vercel

Импортируйте репозиторий, Framework Preset — Vite, добавьте две переменные окружения из `.env`. `vercel.json` уже содержит rewrite для SPA.

## Проверка безопасности

`DEMO_PASSWORD=... node --env-file=.env scripts/security-check.mjs` — обращается к API напрямую, в обход интерфейса, и проверяет RLS, запрет прямой смены статуса, недоступность истории для записи и запрещённые переходы.

## Как устроена защита

- RLS включён на всех таблицах; роль `anon` не имеет прав.
- Статус задачи нельзя изменить через `UPDATE` (нет права на колонку `status`). Единственный путь — функция `change_task_status`, которая проверяет роль, назначенного исполнителя, допустимость перехода и обязательный комментарий при возврате на доработку, и сама пишет историю.
- `task_history` доступна клиентам только на чтение; пишут в неё триггер создания задачи и функция смены статуса.
- Автор задачи задаётся базой (`auth.uid()`), роль в `profiles` клиент менять не может.
