-- Challenge system
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily','weekly')),
  goal_per_period integer NOT NULL DEFAULT 1 CHECK (goal_per_period > 0),
  goal_unit text NOT NULL DEFAULT 'check-in',
  is_public boolean NOT NULL DEFAULT true,
  invite_code text NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(6),'hex'),1,6)) UNIQUE,
  max_participants integer,
  participant_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_challenges_public ON public.challenges(is_public, start_date DESC);
CREATE INDEX idx_challenges_creator ON public.challenges(created_by);

CREATE TABLE public.challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  total_progress integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_log_date date,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX idx_cp_user ON public.challenge_participants(user_id);

CREATE TABLE public.challenge_progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT current_date,
  amount integer NOT NULL DEFAULT 1 CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, log_date)
);
CREATE INDEX idx_cpl_challenge_date ON public.challenge_progress_logs(challenge_id, log_date DESC);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress_logs ENABLE ROW LEVEL SECURITY;

-- Helper: is user a participant in challenge
CREATE OR REPLACE FUNCTION public.is_challenge_participant(_user uuid, _challenge uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.challenge_participants WHERE user_id=_user AND challenge_id=_challenge);
$$;
REVOKE ALL ON FUNCTION public.is_challenge_participant(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_challenge_participant(uuid,uuid) TO authenticated;

-- challenges policies
CREATE POLICY challenges_select_visible ON public.challenges FOR SELECT TO authenticated
USING (is_public = true OR created_by = auth.uid() OR public.is_challenge_participant(auth.uid(), id));

CREATE POLICY challenges_insert_self ON public.challenges FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY challenges_update_creator ON public.challenges FOR UPDATE TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY challenges_delete_creator ON public.challenges FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- participants policies
CREATE POLICY cp_select_visible ON public.challenge_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_challenge_participant(auth.uid(), challenge_id)
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

CREATE POLICY cp_insert_self ON public.challenge_participants FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY cp_update_self ON public.challenge_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY cp_delete_self_or_creator ON public.challenge_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

-- logs policies
CREATE POLICY cpl_select_visible ON public.challenge_progress_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_challenge_participant(auth.uid(), challenge_id)
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

CREATE POLICY cpl_insert_self ON public.challenge_progress_logs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_challenge_participant(auth.uid(), challenge_id)
);

CREATE POLICY cpl_update_self ON public.challenge_progress_logs FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY cpl_delete_self ON public.challenge_progress_logs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Triggers: maintain participant count + streaks
CREATE OR REPLACE FUNCTION public.tg_challenge_participant_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE public.challenges SET participant_count = participant_count + 1, updated_at = now() WHERE id = NEW.challenge_id;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.challenges SET participant_count = GREATEST(participant_count - 1, 0), updated_at = now() WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_challenge_participant_count
AFTER INSERT OR DELETE ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_challenge_participant_count();

-- Enforce max participants on join
CREATE OR REPLACE FUNCTION public.tg_challenge_max_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_max integer; v_count integer;
BEGIN
  SELECT max_participants, participant_count INTO v_max, v_count FROM public.challenges WHERE id = NEW.challenge_id;
  IF v_max IS NOT NULL AND v_count >= v_max THEN
    RAISE EXCEPTION 'Challenge is full';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_challenge_max_check
BEFORE INSERT ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_challenge_max_check();

-- Update participant aggregates on log insert/update/delete
CREATE OR REPLACE FUNCTION public.tg_challenge_log_aggregate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid;
  v_challenge uuid;
  v_total integer;
  v_last date;
  v_streak integer := 0;
  v_longest integer := 0;
  v_cursor date;
BEGIN
  IF TG_OP='DELETE' THEN
    v_user := OLD.user_id; v_challenge := OLD.challenge_id;
  ELSE
    v_user := NEW.user_id; v_challenge := NEW.challenge_id;
  END IF;

  SELECT COALESCE(SUM(amount),0), MAX(log_date)
    INTO v_total, v_last
  FROM public.challenge_progress_logs
  WHERE user_id = v_user AND challenge_id = v_challenge;

  -- compute current streak ending today or yesterday
  IF v_last IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.challenge_progress_logs WHERE user_id=v_user AND challenge_id=v_challenge AND log_date=current_date) THEN
      v_cursor := current_date;
    ELSIF EXISTS (SELECT 1 FROM public.challenge_progress_logs WHERE user_id=v_user AND challenge_id=v_challenge AND log_date=current_date-1) THEN
      v_cursor := current_date - 1;
    END IF;
    WHILE v_cursor IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.challenge_progress_logs WHERE user_id=v_user AND challenge_id=v_challenge AND log_date=v_cursor
    ) LOOP
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    END LOOP;
  END IF;

  SELECT COALESCE(MAX(longest_streak),0) INTO v_longest FROM public.challenge_participants WHERE user_id=v_user AND challenge_id=v_challenge;
  IF v_streak > v_longest THEN v_longest := v_streak; END IF;

  UPDATE public.challenge_participants
    SET total_progress = v_total,
        last_log_date = v_last,
        current_streak = v_streak,
        longest_streak = v_longest
  WHERE user_id = v_user AND challenge_id = v_challenge;

  RETURN NULL;
END $$;

CREATE TRIGGER trg_challenge_log_aggregate
AFTER INSERT OR UPDATE OR DELETE ON public.challenge_progress_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_challenge_log_aggregate();

-- Join via invite code RPC
CREATE OR REPLACE FUNCTION public.join_challenge_by_code(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_id FROM public.challenges WHERE invite_code = upper(p_code);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.challenge_participants(challenge_id, user_id) VALUES (v_id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_challenge_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated;

-- Leaderboard view-style RPC (returns participants + display_name)
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(p_challenge uuid)
RETURNS TABLE(user_id uuid, display_name text, total_progress integer, current_streak integer, longest_streak integer, last_log_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT cp.user_id,
         COALESCE(p.display_name, 'Anon') AS display_name,
         cp.total_progress, cp.current_streak, cp.longest_streak, cp.last_log_date
    FROM public.challenge_participants cp
    LEFT JOIN public.profiles p ON p.id = cp.user_id
   WHERE cp.challenge_id = p_challenge
     AND (
       EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = p_challenge AND (c.is_public OR c.created_by = auth.uid()))
       OR public.is_challenge_participant(auth.uid(), p_challenge)
     )
   ORDER BY cp.total_progress DESC, cp.current_streak DESC;
$$;
REVOKE ALL ON FUNCTION public.challenge_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid) TO authenticated;
