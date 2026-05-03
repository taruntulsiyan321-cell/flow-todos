-- Revoke EXECUTE from anon/authenticated/public on every SECURITY DEFINER function
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE only to authenticated for the RPCs the client calls
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_challenge_participant(uuid, uuid) TO authenticated;
