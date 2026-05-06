
-- 1) Cap xp_reward to a sane range. Clamp existing rows first.
UPDATE public.habits          SET xp_reward = LEAST(GREATEST(xp_reward, 1), 100);
UPDATE public.tasks           SET xp_reward = LEAST(GREATEST(xp_reward, 1), 100);
UPDATE public.journal_entries SET xp_reward = LEAST(GREATEST(xp_reward, 1), 100);
UPDATE public.planner_events  SET xp_reward = LEAST(GREATEST(xp_reward, 1), 100);

ALTER TABLE public.habits          ADD CONSTRAINT habits_xp_reward_range          CHECK (xp_reward BETWEEN 1 AND 100);
ALTER TABLE public.tasks           ADD CONSTRAINT tasks_xp_reward_range           CHECK (xp_reward BETWEEN 1 AND 100);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_xp_reward_range         CHECK (xp_reward BETWEEN 1 AND 100);
ALTER TABLE public.planner_events  ADD CONSTRAINT planner_xp_reward_range         CHECK (xp_reward BETWEEN 1 AND 100);

-- 2) Realtime channel authorization: gate subscriptions on realtime.messages by topic.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rt_authorized_topics_read"  ON realtime.messages;
DROP POLICY IF EXISTS "rt_authorized_topics_write" ON realtime.messages;

CREATE POLICY "rt_authorized_topics_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'chat:%' THEN
      public.is_community_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    WHEN realtime.topic() LIKE 'comments:%' THEN
      EXISTS (
        SELECT 1 FROM public.community_posts cp
        WHERE cp.id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
          AND public.is_community_member(auth.uid(), cp.community_id)
      )
    WHEN realtime.topic() = 'community:push' THEN
      auth.uid() IS NOT NULL
    ELSE false
  END
);

CREATE POLICY "rt_authorized_topics_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'chat:%' THEN
      public.is_community_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    WHEN realtime.topic() LIKE 'comments:%' THEN
      EXISTS (
        SELECT 1 FROM public.community_posts cp
        WHERE cp.id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
          AND public.is_community_member(auth.uid(), cp.community_id)
      )
    WHEN realtime.topic() = 'community:push' THEN
      auth.uid() IS NOT NULL
    ELSE false
  END
);
