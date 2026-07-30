-- =========================
-- LIFE OS FOUNDATION
-- Hierarchical goals, habits 2.0, focus, reviews, learning, memory, etc.
-- =========================

-- Helper: owner-only RLS for user_id tables
create or replace function public.lifeos_enable_owner_rls(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format(
    'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
    p_table || '_select_own', p_table
  );
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
    p_table || '_insert_own', p_table
  );
  execute format(
    'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id)',
    p_table || '_update_own', p_table
  );
  execute format(
    'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
    p_table || '_delete_own', p_table
  );
end;
$$;

-- =========================
-- HABITS 2.0 columns
-- =========================
alter table public.habits
  add column if not exists difficulty integer not null default 3 check (difficulty between 1 and 5),
  add column if not exists reminder_time time,
  add column if not exists is_keystone boolean not null default false,
  add column if not exists stack_after_habit_id uuid references public.habits(id) on delete set null,
  add column if not exists identity_statement text,
  add column if not exists life_area text;

-- =========================
-- TASKS: goal link + anti-procrastination
-- =========================
alter table public.tasks
  add column if not exists goal_id uuid,
  add column if not exists life_area text,
  add column if not exists postponed_count integer not null default 0,
  add column if not exists last_postpone_reason text,
  add column if not exists estimated_minutes integer;

-- =========================
-- TIME LOGS: depth intelligence
-- =========================
alter table public.time_logs
  add column if not exists work_depth text check (work_depth is null or work_depth in ('deep','shallow','break','meeting')),
  add column if not exists interruptions integer not null default 0,
  add column if not exists context_switches integer not null default 0,
  add column if not exists energy_at_start integer check (energy_at_start is null or energy_at_start between 1 and 5),
  add column if not exists focus_session_id uuid;

-- =========================
-- JOURNAL: morning / evening structure
-- =========================
alter table public.journal_entries
  add column if not exists entry_type text not null default 'free'
    check (entry_type in ('free','morning','evening')),
  add column if not exists structured jsonb not null default '{}'::jsonb,
  add column if not exists ai_analysis text;

-- =========================
-- GOALS (hierarchical)
-- vision | year_10 | year_5 | year_1 | quarterly | monthly | weekly | daily
-- =========================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.goals(id) on delete cascade,
  title text not null,
  description text,
  horizon text not null check (horizon in (
    'vision','year_10','year_5','year_1','quarterly','monthly','weekly','daily'
  )),
  life_area text,
  status text not null default 'active'
    check (status in ('active','completed','paused','abandoned')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  target_value numeric,
  current_value numeric default 0,
  unit text,
  start_date date,
  target_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('goals');
create index if not exists idx_goals_user_horizon on public.goals(user_id, horizon) where status = 'active';
create index if not exists idx_goals_parent on public.goals(parent_id);

alter table public.tasks
  drop constraint if exists tasks_goal_id_fkey;
alter table public.tasks
  add constraint tasks_goal_id_fkey foreign key (goal_id) references public.goals(id) on delete set null;

-- =========================
-- LIFE AREAS (Wheel of Life)
-- =========================
create table if not exists public.life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_key text not null,
  label text not null,
  score integer not null default 5 check (score between 1 and 10),
  target_score integer not null default 8 check (target_score between 1 and 10),
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, area_key)
);

select public.lifeos_enable_owner_rls('life_areas');

create table if not exists public.life_area_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_key text not null,
  score integer not null check (score between 1 and 10),
  logged_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('life_area_logs');

-- =========================
-- PERSONAL OKRs
-- =========================
create table if not exists public.okrs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quarter text not null,
  objective text not null,
  life_area text,
  status text not null default 'active'
    check (status in ('active','completed','abandoned')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('okrs');

create table if not exists public.okr_key_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  okr_id uuid not null references public.okrs(id) on delete cascade,
  title text not null,
  target_value numeric not null default 100,
  current_value numeric not null default 0,
  unit text default '%',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('okr_key_results');
create index if not exists idx_okr_kr_okr on public.okr_key_results(okr_id);

-- =========================
-- FOCUS SESSIONS
-- =========================
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'pomodoro'
    check (mode in ('pomodoro','deep_work','custom')),
  planned_minutes integer not null default 25,
  actual_minutes integer,
  task_id uuid references public.tasks(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  ambient_sound text,
  interruptions integer not null default 0,
  completed boolean not null default false,
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('focus_sessions');

alter table public.time_logs
  drop constraint if exists time_logs_focus_session_id_fkey;
alter table public.time_logs
  add constraint time_logs_focus_session_id_fkey
  foreign key (focus_session_id) references public.focus_sessions(id) on delete set null;

-- =========================
-- DECISION JOURNAL
-- =========================
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  decision text not null,
  reason text,
  expected_outcome text,
  risks text,
  confidence integer check (confidence is null or confidence between 1 and 10),
  actual_outcome text,
  outcome_date date,
  quality_score integer check (quality_score is null or quality_score between 1 and 10),
  ai_evaluation text,
  decided_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('decisions');

-- =========================
-- LEARNING TRACKER
-- =========================
create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('book','course','article','podcast','other')),
  title text not null,
  author text,
  status text not null default 'in_progress'
    check (status in ('queued','in_progress','completed','abandoned')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  url text,
  cover_url text,
  started_on date,
  completed_on date,
  key_learnings text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('learning_items');

create table if not exists public.reading_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_item_id uuid references public.learning_items(id) on delete cascade,
  quote text not null,
  note text,
  action_item text,
  location text,
  applied boolean not null default false,
  applied_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('reading_highlights');

-- =========================
-- KNOWLEDGE BASE
-- =========================
create table if not exists public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  source_type text not null default 'note'
    check (source_type in ('note','journal','highlight','meeting','idea','voice','other')),
  source_id uuid,
  tags text[] default '{}',
  embedding_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('knowledge_notes');
create index if not exists idx_knowledge_user_updated on public.knowledge_notes(user_id, updated_at desc);
create index if not exists idx_knowledge_tags on public.knowledge_notes using gin (tags);

-- =========================
-- IDEA VAULT
-- =========================
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'personal'
    check (category in ('startup','business','content','investment','personal','other')),
  tags text[] default '{}',
  cluster_key text,
  status text not null default 'captured'
    check (status in ('captured','exploring','parked','executed','discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('ideas');

-- =========================
-- ENERGY / MOOD / STRESS TRACKER
-- =========================
create table if not exists public.energy_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  log_date date not null default current_date,
  energy integer not null check (energy between 1 and 5),
  mood integer check (mood is null or mood between 1 and 5),
  stress integer check (stress is null or stress between 1 and 5),
  sleep_hours numeric,
  motivation integer check (motivation is null or motivation between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('energy_logs');
create index if not exists idx_energy_user_date on public.energy_logs(user_id, log_date desc);

-- =========================
-- ACCOUNTABILITY (12 Week Year style)
-- =========================
create table if not exists public.accountability_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  kept_promises boolean,
  promises_text text,
  why_not text,
  excuse_tags text[] default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

select public.lifeos_enable_owner_rls('accountability_checkins');

-- =========================
-- IDENTITY STATEMENTS
-- =========================
create table if not exists public.identity_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  statement text not null,
  evidence_count integer not null default 0,
  linked_habit_id uuid references public.habits(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('identity_statements');

-- =========================
-- AI MEMORY + OPERATING MANUAL
-- =========================
create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general'
    check (category in (
      'goal','preference','weakness','strength','project','deadline',
      'habit','reflection','pattern','manual','other'
    )),
  content text not null,
  importance integer not null default 3 check (importance between 1 and 5),
  source text,
  last_reinforced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('ai_memories');
create index if not exists idx_ai_memories_user_cat on public.ai_memories(user_id, category);

create table if not exists public.operating_manual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight text not null,
  confidence numeric not null default 0.5,
  evidence_count integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.lifeos_enable_owner_rls('operating_manual');

-- =========================
-- DAILY / WEEKLY / MONTHLY REVIEWS
-- =========================
create table if not exists public.life_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('daily','weekly','monthly')),
  period_start date not null,
  period_end date not null,
  payload jsonb not null default '{}'::jsonb,
  score integer check (score is null or score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, period, period_start)
);

select public.lifeos_enable_owner_rls('life_reviews');

-- =========================
-- Seed default life areas for existing users
-- =========================
insert into public.life_areas (user_id, area_key, label, score)
select p.id, a.key, a.label, 5
from public.profiles p
cross join (
  values
    ('career', 'Career'),
    ('finance', 'Finance'),
    ('health', 'Health'),
    ('relationships', 'Relationships'),
    ('learning', 'Learning'),
    ('spirituality', 'Spirituality'),
    ('productivity', 'Productivity'),
    ('happiness', 'Happiness')
) as a(key, label)
on conflict (user_id, area_key) do nothing;
