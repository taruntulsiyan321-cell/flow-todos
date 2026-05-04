-- ============================================================
-- Content Moderation System
-- ============================================================

-- Platform admins (created first - referenced by is_platform_admin)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user);
$$;

CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "platform_admins_admin_write" ON public.platform_admins
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Blocked words dictionary
CREATE TABLE IF NOT EXISTS public.moderation_blocked_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.moderation_blocked_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_words_select_auth"
  ON public.moderation_blocked_words FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocked_words_admin_write" ON public.moderation_blocked_words
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Moderation log
CREATE TABLE IF NOT EXISTS public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid,
  surface text NOT NULL,
  original_text text NOT NULL,
  cleaned_text text,
  severity text NOT NULL,
  matched_terms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modlog_user ON public.moderation_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlog_community ON public.moderation_log(community_id, created_at DESC);
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modlog_select_visible" ON public.moderation_log
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR (community_id IS NOT NULL AND public.is_community_admin(auth.uid(), community_id))
  );

-- Community mutes
CREATE TABLE IF NOT EXISTS public.community_mutes (
  community_id uuid NOT NULL,
  user_id uuid NOT NULL,
  muted_until timestamptz NOT NULL,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
ALTER TABLE public.community_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mutes_select" ON public.community_mutes
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_community_admin(auth.uid(), community_id)
    OR public.is_platform_admin(auth.uid())
  );
CREATE POLICY "mutes_admin_write" ON public.community_mutes
  FOR ALL TO authenticated
  USING (public.is_community_admin(auth.uid(), community_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_community_admin(auth.uid(), community_id) OR public.is_platform_admin(auth.uid()));

-- Normalize text for fuzzy matching
CREATE OR REPLACE FUNCTION public.moderation_normalize(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s text;
BEGIN
  IF p IS NULL THEN RETURN ''; END IF;
  s := lower(p);
  s := translate(s, '0134578@$!', 'oletsbtaasi');
  s := regexp_replace(s, '([a-z])\1+', '\1', 'g');
  s := regexp_replace(s, '[^a-z]+', '', 'g');
  RETURN s;
END $$;

-- Build a tolerant regex for a word (letters separated by optional non-letters)
CREATE OR REPLACE FUNCTION public.moderation_word_regex(p_word text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  result text := '';
  i int;
  ch text;
BEGIN
  FOR i IN 1..length(p_word) LOOP
    ch := substr(p_word, i, 1);
    IF i > 1 THEN result := result || '[^a-zA-Z]*'; END IF;
    result := result || ch;
  END LOOP;
  RETURN result;
END $$;

-- Scan text → returns severity, cleaned, matched
CREATE OR REPLACE FUNCTION public.moderation_scan(p text)
RETURNS TABLE(severity text, cleaned text, matched text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  norm text;
  rec record;
  hit_high boolean := false;
  matches text[] := '{}';
  cleaned_out text;
  rgx text;
BEGIN
  cleaned_out := COALESCE(p, '');
  norm := public.moderation_normalize(p);

  FOR rec IN SELECT pattern, severity AS sev FROM public.moderation_blocked_words LOOP
    IF norm LIKE '%' || rec.pattern || '%' THEN
      matches := array_append(matches, rec.pattern);
      IF rec.sev = 'high' THEN hit_high := true; END IF;
      rgx := public.moderation_word_regex(rec.pattern);
      cleaned_out := regexp_replace(cleaned_out, rgx, repeat('*', length(rec.pattern)), 'gi');
    END IF;
  END LOOP;

  IF hit_high THEN
    RETURN QUERY SELECT 'blocked'::text, ''::text, matches;
  ELSIF array_length(matches,1) IS NOT NULL THEN
    RETURN QUERY SELECT 'censored'::text, cleaned_out, matches;
  ELSE
    RETURN QUERY SELECT 'clean'::text, cleaned_out, matches;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.moderation_scan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_normalize(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

-- Triggers — chat
CREATE OR REPLACE FUNCTION public.tg_moderate_chat_msg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until timestamptz; v_sev text; v_clean text; v_matches text[];
BEGIN
  SELECT muted_until INTO v_until FROM public.community_mutes
   WHERE community_id = NEW.community_id AND user_id = NEW.user_id;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RAISE EXCEPTION 'You are muted in this community until %', v_until USING ERRCODE = 'check_violation';
  END IF;
  SELECT severity, cleaned, matched INTO v_sev, v_clean, v_matches FROM public.moderation_scan(NEW.body);
  IF v_sev = 'blocked' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'chat', NEW.body, NULL, 'blocked', v_matches);
    RAISE EXCEPTION 'Your message contains inappropriate language and cannot be posted.' USING ERRCODE = 'check_violation';
  ELSIF v_sev = 'censored' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'chat', NEW.body, v_clean, 'censored', v_matches);
    NEW.body := v_clean;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_moderate_chat_msg ON public.community_messages;
CREATE TRIGGER trg_moderate_chat_msg BEFORE INSERT ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_chat_msg();

CREATE OR REPLACE FUNCTION public.tg_moderate_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until timestamptz; v_sev text; v_clean text; v_matches text[];
BEGIN
  SELECT muted_until INTO v_until FROM public.community_mutes
   WHERE community_id = NEW.community_id AND user_id = NEW.user_id;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RAISE EXCEPTION 'You are muted in this community until %', v_until USING ERRCODE = 'check_violation';
  END IF;
  SELECT severity, cleaned, matched INTO v_sev, v_clean, v_matches FROM public.moderation_scan(NEW.body);
  IF v_sev = 'blocked' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'post', NEW.body, NULL, 'blocked', v_matches);
    RAISE EXCEPTION 'Your message contains inappropriate language and cannot be posted.' USING ERRCODE = 'check_violation';
  ELSIF v_sev = 'censored' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'post', NEW.body, v_clean, 'censored', v_matches);
    NEW.body := v_clean;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_moderate_post ON public.community_posts;
CREATE TRIGGER trg_moderate_post BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_post();

CREATE OR REPLACE FUNCTION public.tg_moderate_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until timestamptz; v_sev text; v_clean text; v_matches text[];
BEGIN
  SELECT muted_until INTO v_until FROM public.community_mutes
   WHERE community_id = NEW.community_id AND user_id = NEW.user_id;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RAISE EXCEPTION 'You are muted in this community until %', v_until USING ERRCODE = 'check_violation';
  END IF;
  SELECT severity, cleaned, matched INTO v_sev, v_clean, v_matches FROM public.moderation_scan(NEW.body);
  IF v_sev = 'blocked' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'comment', NEW.body, NULL, 'blocked', v_matches);
    RAISE EXCEPTION 'Your message contains inappropriate language and cannot be posted.' USING ERRCODE = 'check_violation';
  ELSIF v_sev = 'censored' THEN
    INSERT INTO public.moderation_log(user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms)
    VALUES (NEW.user_id, NEW.community_id, 'comment', NEW.body, v_clean, 'censored', v_matches);
    NEW.body := v_clean;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_moderate_comment ON public.community_post_comments;
CREATE TRIGGER trg_moderate_comment BEFORE INSERT ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_comment();

-- Repeat offenders RPC
CREATE OR REPLACE FUNCTION public.moderation_repeat_offenders(p_days int DEFAULT 30)
RETURNS TABLE(user_id uuid, display_name text, blocked_count bigint, censored_count bigint, last_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id,
         COALESCE(p.display_name, 'Unknown'),
         COUNT(*) FILTER (WHERE m.severity = 'blocked'),
         COUNT(*) FILTER (WHERE m.severity = 'censored'),
         MAX(m.created_at)
  FROM public.moderation_log m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE (public.is_platform_admin(auth.uid())
         OR (m.community_id IS NOT NULL AND public.is_community_admin(auth.uid(), m.community_id)))
    AND m.created_at > now() - (p_days || ' days')::interval
  GROUP BY m.user_id, p.display_name
  ORDER BY COUNT(*) DESC
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.moderation_repeat_offenders(int) TO authenticated;

-- Seed words
INSERT INTO public.moderation_blocked_words(pattern, severity) VALUES
  ('fuck','high'),('shit','medium'),('bitch','high'),('asshole','high'),
  ('dick','medium'),('pussy','high'),('cunt','high'),('bastard','medium'),
  ('slut','high'),('whore','high'),('nigger','high'),('faggot','high'),
  ('retard','high'),('cock','medium'),('porn','medium'),
  ('rape','high'),('damn','low'),('crap','low'),
  ('motherfucker','high'),('bullshit','medium')
ON CONFLICT (pattern) DO NOTHING;