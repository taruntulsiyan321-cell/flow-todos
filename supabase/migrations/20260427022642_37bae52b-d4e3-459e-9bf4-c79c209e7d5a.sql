-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  xp integer not null default 0,
  level integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- HABITS
-- =========================
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'sparkles',
  color text not null default 'primary',
  frequency text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  target_per_period integer not null default 1,
  xp_reward integer not null default 10,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;
create policy "habits_select_own" on public.habits for select to authenticated using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update to authenticated using (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete to authenticated using (auth.uid() = user_id);

create index idx_habits_user on public.habits(user_id) where archived = false;

-- =========================
-- HABIT CHECKINS
-- =========================
create table public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

alter table public.habit_checkins enable row level security;
create policy "checkins_select_own" on public.habit_checkins for select to authenticated using (auth.uid() = user_id);
create policy "checkins_insert_own" on public.habit_checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "checkins_delete_own" on public.habit_checkins for delete to authenticated using (auth.uid() = user_id);

create index idx_checkins_user_date on public.habit_checkins(user_id, completed_on desc);

-- =========================
-- TASKS
-- =========================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  category text not null default 'personal' check (category in ('work','health','study','personal')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  xp_reward integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update to authenticated using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using (auth.uid() = user_id);

create index idx_tasks_user on public.tasks(user_id, completed, due_date);

-- =========================
-- ACHIEVEMENTS
-- =========================
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

alter table public.achievements enable row level security;
create policy "achievements_select_own" on public.achievements for select to authenticated using (auth.uid() = user_id);
create policy "achievements_insert_own" on public.achievements for insert to authenticated with check (auth.uid() = user_id);

-- =========================
-- XP / LEVEL / STREAK ENGINE
-- =========================

-- level required for given xp: level n needs n*100 cumulative xp (simple curve)
create or replace function public.calc_level(p_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 1;
  needed integer := 100;
  remaining integer := p_xp;
begin
  while remaining >= needed and lvl < 100 loop
    remaining := remaining - needed;
    lvl := lvl + 1;
    needed := lvl * 100;
  end loop;
  return lvl;
end;
$$;

create or replace function public.award_xp(p_user uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_yesterday date := current_date - 1;
  v_last date;
  v_streak integer;
  v_longest integer;
  v_new_xp integer;
begin
  select last_active_date, current_streak, longest_streak
    into v_last, v_streak, v_longest
  from public.profiles where id = p_user;

  if v_last is null or v_last < v_yesterday then
    v_streak := 1;
  elsif v_last = v_yesterday then
    v_streak := coalesce(v_streak,0) + 1;
  end if;
  -- v_last = today: keep streak unchanged

  if v_streak > coalesce(v_longest,0) then
    v_longest := v_streak;
  end if;

  update public.profiles
  set xp = xp + p_amount,
      level = public.calc_level(xp + p_amount),
      current_streak = v_streak,
      longest_streak = v_longest,
      last_active_date = v_today,
      updated_at = now()
  where id = p_user
  returning xp into v_new_xp;
end;
$$;

-- Habit checkin -> award xp
create or replace function public.on_habit_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
begin
  select xp_reward into v_xp from public.habits where id = new.habit_id;
  perform public.award_xp(new.user_id, coalesce(v_xp, 10));
  return new;
end;
$$;

create trigger habit_checkin_award_xp
  after insert on public.habit_checkins
  for each row execute function public.on_habit_checkin();

-- Task completion -> award xp on transition to completed
create or replace function public.on_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed = true and (old.completed is distinct from true) then
    new.completed_at := now();
    perform public.award_xp(new.user_id, coalesce(new.xp_reward, 15));
  elsif new.completed = false then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger task_update_xp
  before update on public.tasks
  for each row execute function public.on_task_update();

create or replace function public.on_task_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed = true then
    new.completed_at := now();
    perform public.award_xp(new.user_id, coalesce(new.xp_reward, 15));
  end if;
  return new;
end;
$$;

create trigger task_insert_xp
  before insert on public.tasks
  for each row execute function public.on_task_insert();
