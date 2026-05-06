
-- 1. Restrict moderation_blocked_words SELECT to platform admins only.
DROP POLICY IF EXISTS blocked_words_select_auth ON public.moderation_blocked_words;
CREATE POLICY blocked_words_select_admin
  ON public.moderation_blocked_words
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 2. Strip invite_code from direct column SELECT on challenges & communities.
-- RLS rows still readable, but the invite_code column is unreadable except via SECURITY DEFINER RPCs.
REVOKE SELECT (invite_code) ON public.challenges FROM authenticated, anon;
REVOKE SELECT (invite_code) ON public.communities FROM authenticated, anon;

-- 3. Prevent users from self-inserting into private challenges; require RPC for private joins.
DROP POLICY IF EXISTS cp_insert_self ON public.challenge_participants;
CREATE POLICY cp_insert_self
  ON public.challenge_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id AND c.is_public = true
    )
  );
-- Note: join_challenge_by_code is SECURITY DEFINER so it still works for private invites.
