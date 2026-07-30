-- Daily Scheduler: simple per-day to-do list with optional reminder time
create table if not exists public.daily_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  scheduled_date date not null default current_date,
  completed boolean not null default false,
  completed_at timestamptz,
  remind_at time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_todos enable row level security;

create policy "daily_todos_select_own" on public.daily_todos
  for select to authenticated using (auth.uid() = user_id);
create policy "daily_todos_insert_own" on public.daily_todos
  for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_todos_update_own" on public.daily_todos
  for update to authenticated using (auth.uid() = user_id);
create policy "daily_todos_delete_own" on public.daily_todos
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_daily_todos_user_date
  on public.daily_todos(user_id, scheduled_date desc);

create index if not exists idx_daily_todos_open
  on public.daily_todos(user_id, scheduled_date)
  where completed = false;
