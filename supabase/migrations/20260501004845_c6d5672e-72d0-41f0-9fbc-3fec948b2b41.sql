
CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (id uuid, display_name text, xp integer, level integer, current_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, display_name, xp, level, current_streak
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL
    AND display_name ILIKE '%' || p_query || '%'
    AND id <> auth.uid()
  ORDER BY xp DESC
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profiles(p_ids uuid[])
RETURNS TABLE (id uuid, display_name text, xp integer, level integer, current_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, display_name, xp, level, current_streak
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL
    AND id = ANY(p_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
