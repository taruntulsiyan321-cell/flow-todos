-- Restrict column-level access to matched_terms on moderation_log.
-- Community admins can still read other columns via existing RLS, but the
-- raw blocked-word patterns are now only visible to platform admins.
REVOKE SELECT (matched_terms) ON public.moderation_log FROM authenticated, anon;

-- Provide a controlled accessor for platform admins (who manage the word list).
CREATE OR REPLACE FUNCTION public.get_moderation_matched_terms(p_log_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT matched_terms
    FROM public.moderation_log
   WHERE id = p_log_id
     AND public.is_platform_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_moderation_matched_terms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_moderation_matched_terms(uuid) TO authenticated;
