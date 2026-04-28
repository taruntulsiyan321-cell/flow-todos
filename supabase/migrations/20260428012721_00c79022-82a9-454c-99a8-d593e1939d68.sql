-- Journal entries
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  content text NOT NULL,
  mood smallint CHECK (mood BETWEEN 1 AND 5),
  tags text[] DEFAULT '{}',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  xp_reward integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_select_own ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY journal_insert_own ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY journal_update_own ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY journal_delete_own ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_journal_user_date ON public.journal_entries(user_id, entry_date DESC);

-- Planner events
CREATE TABLE public.planner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time,
  end_time time,
  category text NOT NULL DEFAULT 'personal',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  xp_reward integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY planner_select_own ON public.planner_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY planner_insert_own ON public.planner_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY planner_update_own ON public.planner_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY planner_delete_own ON public.planner_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_planner_user_date ON public.planner_events(user_id, event_date);

-- Trigger: award XP for journal insert
CREATE OR REPLACE FUNCTION public.on_journal_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_xp(NEW.user_id, COALESCE(NEW.xp_reward, 20));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_insert
AFTER INSERT ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.on_journal_insert();

-- Trigger: planner event update — touch updated_at + award XP on completion
CREATE OR REPLACE FUNCTION public.on_planner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS DISTINCT FROM true) THEN
    NEW.completed_at := now();
    PERFORM public.award_xp(NEW.user_id, COALESCE(NEW.xp_reward, 10));
  ELSIF NEW.completed = false THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_planner_update
BEFORE UPDATE ON public.planner_events
FOR EACH ROW EXECUTE FUNCTION public.on_planner_update();

-- Trigger: planner event insert created already-completed
CREATE OR REPLACE FUNCTION public.on_planner_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true THEN
    NEW.completed_at := now();
    PERFORM public.award_xp(NEW.user_id, COALESCE(NEW.xp_reward, 10));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_planner_insert
BEFORE INSERT ON public.planner_events
FOR EACH ROW EXECUTE FUNCTION public.on_planner_insert();
