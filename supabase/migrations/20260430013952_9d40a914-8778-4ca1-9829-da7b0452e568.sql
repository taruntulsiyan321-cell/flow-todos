
-- ============================================================
-- Communities platform
-- ============================================================

-- Communities
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  description text CHECK (char_length(description) <= 500),
  category text NOT NULL DEFAULT 'general' CHECK (char_length(category) <= 40),
  banner_url text,
  is_private boolean NOT NULL DEFAULT false,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by uuid NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_category ON public.communities(category);
CREATE INDEX idx_communities_created_by ON public.communities(created_by);

-- Members
CREATE TYPE public.community_role AS ENUM ('member', 'moderator', 'admin');

CREATE TABLE public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.community_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);

-- Posts
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text CHECK (char_length(title) <= 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  auto_kind text CHECK (auto_kind IN ('streak_milestone','level_up','challenge_complete')),
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_community_created ON public.community_posts(community_id, created_at DESC);
CREATE INDEX idx_posts_user ON public.community_posts(user_id);

-- Likes
CREATE TABLE public.community_post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_likes_user ON public.community_post_likes(user_id);

-- Challenges
CREATE TABLE public.community_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  description text CHECK (char_length(description) <= 600),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  target_xp integer NOT NULL DEFAULT 100 CHECK (target_xp BETWEEN 10 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_challenges_community ON public.community_challenges(community_id, ends_on DESC);

-- Challenge participants
CREATE TABLE public.community_challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  xp_earned integer NOT NULL DEFAULT 0,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX idx_challenge_participants_user ON public.community_challenge_participants(user_id);

-- ============================================================
-- Helper functions (security definer, prevent RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_community_member(_user uuid, _community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = _user AND community_id = _community
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_user uuid, _community uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = _user
      AND community_id = _community
      AND role IN ('admin','moderator')
  );
$$;

-- ============================================================
-- Triggers: counters and creator-as-admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_community_creator_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.community_members(community_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_community_creator_admin
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.tg_community_creator_admin();

CREATE OR REPLACE FUNCTION public.tg_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
       SET member_count = member_count + 1, updated_at = now()
     WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
       SET member_count = GREATEST(member_count - 1, 0), updated_at = now()
     WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_member_count_ins
AFTER INSERT ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.tg_member_count();
CREATE TRIGGER trg_member_count_del
AFTER DELETE ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.tg_member_count();

CREATE OR REPLACE FUNCTION public.tg_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_like_count_ins
AFTER INSERT ON public.community_post_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_post_like_count();
CREATE TRIGGER trg_post_like_count_del
AFTER DELETE ON public.community_post_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_post_like_count();

-- ============================================================
-- Public-safe view: only achievements, never habit/task/journal contents
-- ============================================================

CREATE OR REPLACE VIEW public.community_member_stats
WITH (security_invoker = on) AS
SELECT
  cm.community_id,
  cm.user_id,
  cm.role,
  cm.joined_at,
  p.display_name,
  p.avatar_url,
  p.xp,
  p.level,
  p.current_streak,
  p.longest_streak
FROM public.community_members cm
JOIN public.profiles p ON p.id = cm.user_id;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_challenge_participants ENABLE ROW LEVEL SECURITY;

-- communities: anyone authenticated can see public ones; members see private ones too
CREATE POLICY communities_select_public_or_member ON public.communities
  FOR SELECT TO authenticated
  USING (is_private = false OR public.is_community_member(auth.uid(), id));

CREATE POLICY communities_insert_self ON public.communities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY communities_update_admin ON public.communities
  FOR UPDATE TO authenticated
  USING (public.is_community_admin(auth.uid(), id));

CREATE POLICY communities_delete_admin ON public.communities
  FOR DELETE TO authenticated
  USING (public.is_community_admin(auth.uid(), id));

-- community_members: members can see roster of their communities; users can see their own membership rows
CREATE POLICY members_select_visible ON public.community_members
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_community_member(auth.uid(), community_id)
  );

CREATE POLICY members_insert_self ON public.community_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY members_delete_self_or_admin ON public.community_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_community_admin(auth.uid(), community_id)
  );

CREATE POLICY members_update_admin ON public.community_members
  FOR UPDATE TO authenticated
  USING (public.is_community_admin(auth.uid(), community_id));

-- posts
CREATE POLICY posts_select_member ON public.community_posts
  FOR SELECT TO authenticated
  USING (public.is_community_member(auth.uid(), community_id));

CREATE POLICY posts_insert_member ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_community_member(auth.uid(), community_id)
  );

CREATE POLICY posts_update_own ON public.community_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY posts_delete_own_or_admin ON public.community_posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_community_admin(auth.uid(), community_id)
  );

-- likes
CREATE POLICY likes_select_member ON public.community_post_likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts cp
      WHERE cp.id = post_id AND public.is_community_member(auth.uid(), cp.community_id)
    )
  );

CREATE POLICY likes_insert_self ON public.community_post_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      WHERE cp.id = post_id AND public.is_community_member(auth.uid(), cp.community_id)
    )
  );

CREATE POLICY likes_delete_self ON public.community_post_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- challenges
CREATE POLICY challenges_select_member ON public.community_challenges
  FOR SELECT TO authenticated
  USING (public.is_community_member(auth.uid(), community_id));

CREATE POLICY challenges_insert_admin ON public.community_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_community_admin(auth.uid(), community_id)
  );

CREATE POLICY challenges_update_admin ON public.community_challenges
  FOR UPDATE TO authenticated
  USING (public.is_community_admin(auth.uid(), community_id));

CREATE POLICY challenges_delete_admin ON public.community_challenges
  FOR DELETE TO authenticated
  USING (public.is_community_admin(auth.uid(), community_id));

-- challenge participants
CREATE POLICY chp_select_member ON public.community_challenge_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_challenges c
      WHERE c.id = challenge_id AND public.is_community_member(auth.uid(), c.community_id)
    )
  );

CREATE POLICY chp_insert_self ON public.community_challenge_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.community_challenges c
      WHERE c.id = challenge_id AND public.is_community_member(auth.uid(), c.community_id)
    )
  );

CREATE POLICY chp_delete_self ON public.community_challenge_participants
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY chp_update_self ON public.community_challenge_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
