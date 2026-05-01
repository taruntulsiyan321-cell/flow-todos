
-- ============ COMMENTS ============
CREATE TABLE public.community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cpc_post ON public.community_post_comments(post_id, created_at);
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpc_select_member ON public.community_post_comments FOR SELECT TO authenticated
  USING (public.is_community_member(auth.uid(), community_id));
CREATE POLICY cpc_insert_member ON public.community_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_community_member(auth.uid(), community_id));
CREATE POLICY cpc_delete_own_or_admin ON public.community_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_community_admin(auth.uid(), community_id));
CREATE POLICY cpc_update_own ON public.community_post_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.community_post_comment_likes (
  comment_id uuid NOT NULL REFERENCES public.community_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
ALTER TABLE public.community_post_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpcl_select_member ON public.community_post_comment_likes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_post_comments c
    WHERE c.id = comment_id AND public.is_community_member(auth.uid(), c.community_id)));
CREATE POLICY cpcl_insert_self ON public.community_post_comment_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.community_post_comments c
    WHERE c.id = comment_id AND public.is_community_member(auth.uid(), c.community_id)));
CREATE POLICY cpcl_delete_self ON public.community_post_comment_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_cpcl_count
AFTER INSERT OR DELETE ON public.community_post_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_comment_like_count();

-- ============ CHAT MESSAGES ============
CREATE TABLE public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cm_community ON public.community_messages(community_id, created_at);
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_select_member ON public.community_messages FOR SELECT TO authenticated
  USING (public.is_community_member(auth.uid(), community_id));
CREATE POLICY cm_insert_member ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_community_member(auth.uid(), community_id));
CREATE POLICY cm_delete_own_or_admin ON public.community_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_community_admin(auth.uid(), community_id));

-- ============ PARTNER INVITES ============
CREATE TYPE public.partner_invite_status AS ENUM ('pending','accepted','declined','cancelled');

CREATE TABLE public.partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  message text CHECK (message IS NULL OR length(message) <= 280),
  status public.partner_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (from_user <> to_user)
);
CREATE UNIQUE INDEX uniq_pending_invite
  ON public.partner_invites(from_user, to_user) WHERE status = 'pending';
ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY pi_select_party ON public.partner_invites FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY pi_insert_self ON public.partner_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);
CREATE POLICY pi_update_party ON public.partner_invites FOR UPDATE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY pi_delete_party ON public.partner_invites FOR DELETE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- ============ PARTNERSHIPS ============
CREATE TABLE public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b)
);
CREATE UNIQUE INDEX uniq_partnership ON public.partnerships(user_a, user_b);
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY part_select_party ON public.partnerships FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY part_delete_party ON public.partnerships FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
-- inserts only via accept_partner_invite() (security definer)

-- Accept an invite and create the pairing atomically
CREATE OR REPLACE FUNCTION public.accept_partner_invite(p_invite uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from uuid; v_to uuid; v_status public.partner_invite_status;
  v_a uuid; v_b uuid; v_id uuid;
BEGIN
  SELECT from_user, to_user, status INTO v_from, v_to, v_status
  FROM public.partner_invites WHERE id = p_invite;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF auth.uid() <> v_to THEN RAISE EXCEPTION 'Not your invite'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Already %', v_status; END IF;

  IF v_from < v_to THEN v_a := v_from; v_b := v_to; ELSE v_a := v_to; v_b := v_from; END IF;

  UPDATE public.partner_invites
     SET status = 'accepted', responded_at = now()
   WHERE id = p_invite;

  INSERT INTO public.partnerships(user_a, user_b)
  VALUES (v_a, v_b)
  ON CONFLICT (user_a, user_b) DO UPDATE SET created_at = public.partnerships.created_at
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_post_comments;
