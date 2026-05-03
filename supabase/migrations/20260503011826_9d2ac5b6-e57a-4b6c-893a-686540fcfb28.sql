CREATE OR REPLACE FUNCTION public.join_community_by_code(p_code text)
RETURNS TABLE(id uuid, slug text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT c.id, c.slug INTO v_id, v_slug FROM public.communities c WHERE c.invite_code = lower(p_code);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.community_members(community_id, user_id) VALUES (v_id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT v_id, v_slug;
END $$;
REVOKE ALL ON FUNCTION public.join_community_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_community_by_code(text) TO authenticated;
