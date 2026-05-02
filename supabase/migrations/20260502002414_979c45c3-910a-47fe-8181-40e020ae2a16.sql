-- Revoke broad EXECUTE on every SECURITY DEFINER function in public, then
-- re-grant only the RPCs the client genuinely calls, and only to authenticated users.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END$$;

-- Re-grant EXECUTE for the three RPCs the app calls from the browser.
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(uuid) TO authenticated;
