
-- 1. moderation_log: restrict community admin direct access; use RPC instead
DROP POLICY IF EXISTS modlog_select_visible ON public.moderation_log;

CREATE POLICY modlog_select_visible ON public.moderation_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.community_moderation_log(p_community uuid, p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  community_id uuid,
  surface text,
  original_text text,
  cleaned_text text,
  severity text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.community_id, m.surface,
         m.original_text, m.cleaned_text, m.severity, m.created_at
  FROM public.moderation_log m
  WHERE m.community_id = p_community
    AND (public.is_platform_admin(auth.uid())
         OR public.is_community_admin(auth.uid(), p_community))
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

REVOKE EXECUTE ON FUNCTION public.community_moderation_log(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_moderation_log(uuid, integer) TO authenticated;

-- 2. profiles: prevent users from inflating XP/level/streak fields via direct UPDATE.
-- Use a BEFORE UPDATE trigger that resets game-sensitive columns to OLD values when
-- the call is made by the 'authenticated' role (not SECURITY DEFINER server logic).
CREATE OR REPLACE FUNCTION public.tg_profiles_protect_game_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER functions run as table owner (current_user != 'authenticated'),
  -- so server-side recompute_user_stats / award_xp can still mutate these columns.
  IF current_user = 'authenticated' THEN
    NEW.xp := OLD.xp;
    NEW.level := OLD.level;
    NEW.current_streak := OLD.current_streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.last_active_date := OLD.last_active_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_game_fields ON public.profiles;
CREATE TRIGGER profiles_protect_game_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_game_fields();

-- Also add WITH CHECK on the policy for clarity/defence-in-depth.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. community_challenge_participants: drop user-writable update policy
DROP POLICY IF EXISTS chp_update_self ON public.community_challenge_participants;
