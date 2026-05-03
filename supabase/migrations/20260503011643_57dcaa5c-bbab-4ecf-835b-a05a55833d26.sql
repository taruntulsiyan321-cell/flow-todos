-- 1) Restrict invite_code visibility
-- Communities: only creator/admin can see invite_code; for everyone else expose via a function
CREATE OR REPLACE FUNCTION public.get_community_invite_code(p_community uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT invite_code FROM public.communities
   WHERE id = p_community
     AND (created_by = auth.uid() OR public.is_community_admin(auth.uid(), id));
$$;
REVOKE ALL ON FUNCTION public.get_community_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_invite_code(uuid) TO authenticated;

-- Challenges: only creator can see invite_code
CREATE OR REPLACE FUNCTION public.get_challenge_invite_code(p_challenge uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT invite_code FROM public.challenges
   WHERE id = p_challenge AND created_by = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_challenge_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_invite_code(uuid) TO authenticated;

-- Strip invite_code from default SELECT by revoking column SELECT, then re-grant other columns
-- Easier: use column-level GRANTs. First revoke SELECT on the whole table, then grant on safe columns only.
REVOKE SELECT ON public.communities FROM authenticated;
GRANT SELECT (id, name, slug, description, category, banner_url, is_private, member_count,
              created_by, created_at, updated_at)
  ON public.communities TO authenticated;

REVOKE SELECT ON public.challenges FROM authenticated;
GRANT SELECT (id, created_by, name, description, start_date, end_date, cadence,
              goal_per_period, goal_unit, is_public, max_participants, participant_count,
              created_at, updated_at)
  ON public.challenges TO authenticated;

-- 2) Partner invites: split UPDATE so sender can only cancel; recipient can accept/decline
DROP POLICY IF EXISTS pi_update_party ON public.partner_invites;

CREATE POLICY pi_update_recipient ON public.partner_invites
FOR UPDATE TO authenticated
USING (auth.uid() = to_user)
WITH CHECK (auth.uid() = to_user AND status IN ('accepted','declined'));

CREATE POLICY pi_update_sender_cancel ON public.partner_invites
FOR UPDATE TO authenticated
USING (auth.uid() = from_user AND status = 'pending')
WITH CHECK (auth.uid() = from_user AND status = 'cancelled');
