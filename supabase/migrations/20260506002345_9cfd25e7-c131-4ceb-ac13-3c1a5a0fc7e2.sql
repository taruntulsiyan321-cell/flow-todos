
-- 1) Hide invite_code from general SELECT — only accessible via SECURITY DEFINER RPCs
REVOKE SELECT (invite_code) ON public.challenges FROM authenticated, anon;
REVOKE SELECT (invite_code) ON public.communities FROM authenticated, anon;

-- Re-grant SELECT on all OTHER columns to authenticated (column-level grants)
GRANT SELECT (id, created_by, name, description, start_date, end_date, cadence,
              goal_per_period, goal_unit, is_public, max_participants,
              participant_count, created_at, updated_at)
  ON public.challenges TO authenticated;

GRANT SELECT (id, created_by, name, slug, description, category, banner_url,
              is_private, member_count, created_at, updated_at)
  ON public.communities TO authenticated;

-- 2) Prevent self-insert into private communities (must use join_community_by_code RPC)
DROP POLICY IF EXISTS members_insert_self ON public.community_members;
CREATE POLICY members_insert_self ON public.community_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id AND c.is_private = false
    )
  );

-- 3) Remove direct INSERT on achievements — only server logic should award badges
DROP POLICY IF EXISTS achievements_insert_own ON public.achievements;

-- 4) Lock down SECURITY DEFINER invite RPCs to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_challenge_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_community_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_invite_code(uuid) TO authenticated;
