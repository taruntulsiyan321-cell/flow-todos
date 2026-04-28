
-- =========================================================
-- 1) XP LEDGER TABLE — single source of truth for XP changes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  kind text NOT NULL,                -- 'habit_checkin' | 'task' | 'journal' | 'planner'
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  occurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate awards from the same source/kind
CREATE UNIQUE INDEX IF NOT EXISTS xp_ledger_unique_source
  ON public.xp_ledger (source_table, source_id, kind);

CREATE INDEX IF NOT EXISTS xp_ledger_user_date_idx
  ON public.xp_ledger (user_id, occurred_on DESC);

ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xp_ledger_select_own ON public.xp_ledger;
CREATE POLICY xp_ledger_select_own
  ON public.xp_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- No insert/update/delete policies → only SECURITY DEFINER triggers can write.

-- =========================================================
-- 2) RECOMPUTE FUNCTION — derive XP + streaks from data
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_user_stats(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_xp   integer := 0;
  v_level      integer := 1;
  v_streak     integer := 0;
  v_longest    integer := 0;
  v_last       date;
  v_active     date;
  v_cursor     date;
BEGIN
  -- Total XP from ledger
  SELECT COALESCE(SUM(amount), 0) INTO v_total_xp
  FROM public.xp_ledger WHERE user_id = p_user;

  v_level := public.calc_level(v_total_xp);

  -- Build distinct set of "active days" from real activity:
  --   habit check-ins, completed tasks, completed planner events, journal entries
  CREATE TEMP TABLE IF NOT EXISTS _active_days(d date PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _active_days;

  INSERT INTO _active_days(d)
  SELECT DISTINCT completed_on FROM public.habit_checkins WHERE user_id = p_user
  ON CONFLICT DO NOTHING;

  INSERT INTO _active_days(d)
  SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date
    FROM public.tasks
   WHERE user_id = p_user AND completed = true AND completed_at IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO _active_days(d)
  SELECT DISTINCT event_date FROM public.planner_events
   WHERE user_id = p_user AND completed = true
  ON CONFLICT DO NOTHING;

  INSERT INTO _active_days(d)
  SELECT DISTINCT entry_date FROM public.journal_entries WHERE user_id = p_user
  ON CONFLICT DO NOTHING;

  -- Last active day overall
  SELECT MAX(d) INTO v_last FROM _active_days;

  -- Current streak: consecutive days ending today, or yesterday if today is empty
  IF v_last IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM _active_days WHERE d = current_date) THEN
      v_cursor := current_date;
    ELSIF EXISTS (SELECT 1 FROM _active_days WHERE d = current_date - 1) THEN
      v_cursor := current_date - 1;
    ELSE
      v_cursor := NULL;
    END IF;

    WHILE v_cursor IS NOT NULL AND EXISTS (SELECT 1 FROM _active_days WHERE d = v_cursor) LOOP
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    END LOOP;
  END IF;

  -- Longest streak: scan all active days
  v_longest := 0;
  DECLARE
    v_run integer := 0;
    v_prev date;
  BEGIN
    FOR v_active IN SELECT d FROM _active_days ORDER BY d LOOP
      IF v_prev IS NOT NULL AND v_active = v_prev + 1 THEN
        v_run := v_run + 1;
      ELSE
        v_run := 1;
      END IF;
      IF v_run > v_longest THEN v_longest := v_run; END IF;
      v_prev := v_active;
    END LOOP;
  END;

  IF v_streak > v_longest THEN v_longest := v_streak; END IF;

  UPDATE public.profiles
     SET xp = v_total_xp,
         level = v_level,
         current_streak = v_streak,
         longest_streak = v_longest,
         last_active_date = v_last,
         updated_at = now()
   WHERE id = p_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_user_stats(uuid) FROM PUBLIC;

-- =========================================================
-- 3) NEW TRIGGER FUNCTIONS — write to ledger, then recompute
-- =========================================================

-- ---- HABIT CHECK-INS ----
CREATE OR REPLACE FUNCTION public.tg_habit_checkin_aiu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_xp integer;
BEGIN
  SELECT COALESCE(xp_reward, 10) INTO v_xp FROM public.habits WHERE id = NEW.habit_id;
  INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
  VALUES (NEW.user_id, COALESCE(v_xp, 10), 'habit_checkin', 'habit_checkins', NEW.id, NEW.completed_on)
  ON CONFLICT (source_table, source_id, kind) DO NOTHING;
  PERFORM public.recompute_user_stats(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_habit_checkin_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_ledger
   WHERE source_table = 'habit_checkins' AND source_id = OLD.id;
  PERFORM public.recompute_user_stats(OLD.user_id);
  RETURN OLD;
END;
$$;

-- ---- TASKS ----
CREATE OR REPLACE FUNCTION public.tg_tasks_biu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Maintain completed_at honestly
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed = true AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.completed = true AND OLD.completed IS DISTINCT FROM true THEN
      NEW.completed_at := now();
    ELSIF NEW.completed = false THEN
      NEW.completed_at := NULL;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_tasks_aiu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true THEN
    INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
    VALUES (NEW.user_id, COALESCE(NEW.xp_reward, 15), 'task', 'tasks', NEW.id,
            COALESCE((NEW.completed_at AT TIME ZONE 'UTC')::date, current_date))
    ON CONFLICT (source_table, source_id, kind) DO NOTHING;
  ELSE
    DELETE FROM public.xp_ledger WHERE source_table = 'tasks' AND source_id = NEW.id;
  END IF;
  PERFORM public.recompute_user_stats(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_tasks_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_ledger WHERE source_table = 'tasks' AND source_id = OLD.id;
  PERFORM public.recompute_user_stats(OLD.user_id);
  RETURN OLD;
END;
$$;

-- ---- JOURNAL ENTRIES ----
CREATE OR REPLACE FUNCTION public.tg_journal_aiu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
  VALUES (NEW.user_id, COALESCE(NEW.xp_reward, 20), 'journal', 'journal_entries', NEW.id, NEW.entry_date)
  ON CONFLICT (source_table, source_id, kind) DO NOTHING;
  PERFORM public.recompute_user_stats(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_journal_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_ledger WHERE source_table = 'journal_entries' AND source_id = OLD.id;
  PERFORM public.recompute_user_stats(OLD.user_id);
  RETURN OLD;
END;
$$;

-- ---- PLANNER EVENTS ----
CREATE OR REPLACE FUNCTION public.tg_planner_biu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed = true AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.completed = true AND OLD.completed IS DISTINCT FROM true THEN
      NEW.completed_at := now();
    ELSIF NEW.completed = false THEN
      NEW.completed_at := NULL;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_planner_aiu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true THEN
    INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
    VALUES (NEW.user_id, COALESCE(NEW.xp_reward, 10), 'planner', 'planner_events', NEW.id, NEW.event_date)
    ON CONFLICT (source_table, source_id, kind) DO NOTHING;
  ELSE
    DELETE FROM public.xp_ledger WHERE source_table = 'planner_events' AND source_id = NEW.id;
  END IF;
  PERFORM public.recompute_user_stats(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_planner_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_ledger WHERE source_table = 'planner_events' AND source_id = OLD.id;
  PERFORM public.recompute_user_stats(OLD.user_id);
  RETURN OLD;
END;
$$;

-- =========================================================
-- 4) DROP OLD TRIGGERS, ATTACH NEW ONES
-- =========================================================

-- Habits
DROP TRIGGER IF EXISTS habit_checkins_after_insert ON public.habit_checkins;
DROP TRIGGER IF EXISTS on_habit_checkin_trg ON public.habit_checkins;
DROP TRIGGER IF EXISTS trg_habit_checkin ON public.habit_checkins;
CREATE TRIGGER trg_habit_checkin_aiu
AFTER INSERT OR UPDATE ON public.habit_checkins
FOR EACH ROW EXECUTE FUNCTION public.tg_habit_checkin_aiu();
CREATE TRIGGER trg_habit_checkin_ad
AFTER DELETE ON public.habit_checkins
FOR EACH ROW EXECUTE FUNCTION public.tg_habit_checkin_ad();

-- Tasks
DROP TRIGGER IF EXISTS tasks_before_insert ON public.tasks;
DROP TRIGGER IF EXISTS tasks_before_update ON public.tasks;
DROP TRIGGER IF EXISTS on_task_insert_trg ON public.tasks;
DROP TRIGGER IF EXISTS on_task_update_trg ON public.tasks;
CREATE TRIGGER trg_tasks_biu
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_biu();
CREATE TRIGGER trg_tasks_aiu
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_aiu();
CREATE TRIGGER trg_tasks_ad
AFTER DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_ad();

-- Journal
DROP TRIGGER IF EXISTS journal_after_insert ON public.journal_entries;
DROP TRIGGER IF EXISTS on_journal_insert_trg ON public.journal_entries;
CREATE TRIGGER trg_journal_aiu
AFTER INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_journal_aiu();
CREATE TRIGGER trg_journal_ad
AFTER DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_journal_ad();

-- Planner
DROP TRIGGER IF EXISTS planner_before_insert ON public.planner_events;
DROP TRIGGER IF EXISTS planner_before_update ON public.planner_events;
DROP TRIGGER IF EXISTS on_planner_insert_trg ON public.planner_events;
DROP TRIGGER IF EXISTS on_planner_update_trg ON public.planner_events;
CREATE TRIGGER trg_planner_biu
BEFORE INSERT OR UPDATE ON public.planner_events
FOR EACH ROW EXECUTE FUNCTION public.tg_planner_biu();
CREATE TRIGGER trg_planner_aiu
AFTER INSERT OR UPDATE ON public.planner_events
FOR EACH ROW EXECUTE FUNCTION public.tg_planner_aiu();
CREATE TRIGGER trg_planner_ad
AFTER DELETE ON public.planner_events
FOR EACH ROW EXECUTE FUNCTION public.tg_planner_ad();

-- =========================================================
-- 5) BACKFILL LEDGER FROM EXISTING DATA + RECONCILE
-- =========================================================

-- Habit check-ins
INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
SELECT hc.user_id, COALESCE(h.xp_reward, 10), 'habit_checkin', 'habit_checkins', hc.id, hc.completed_on
  FROM public.habit_checkins hc
  JOIN public.habits h ON h.id = hc.habit_id
ON CONFLICT (source_table, source_id, kind) DO NOTHING;

-- Completed tasks
INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
SELECT t.user_id, COALESCE(t.xp_reward, 15), 'task', 'tasks', t.id,
       COALESCE((t.completed_at AT TIME ZONE 'UTC')::date, current_date)
  FROM public.tasks t
 WHERE t.completed = true
ON CONFLICT (source_table, source_id, kind) DO NOTHING;

-- Journal entries
INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
SELECT j.user_id, COALESCE(j.xp_reward, 20), 'journal', 'journal_entries', j.id, j.entry_date
  FROM public.journal_entries j
ON CONFLICT (source_table, source_id, kind) DO NOTHING;

-- Completed planner events
INSERT INTO public.xp_ledger(user_id, amount, kind, source_table, source_id, occurred_on)
SELECT p.user_id, COALESCE(p.xp_reward, 10), 'planner', 'planner_events', p.id, p.event_date
  FROM public.planner_events p
 WHERE p.completed = true
ON CONFLICT (source_table, source_id, kind) DO NOTHING;

-- Recompute every profile from scratch (fixes inflated XP / fake streaks)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recompute_user_stats(r.id);
  END LOOP;
END $$;
