
-- Revoke EXECUTE from PUBLIC/anon/authenticated on internal trigger and helper
-- functions. Trigger functions still fire (triggers run as table owner), but
-- they cannot be invoked directly via RPC anymore.

DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'handle_new_user()',
    'award_xp(uuid,integer)',
    'recompute_user_stats(uuid)',
    'on_task_insert()',
    'on_task_update()',
    'on_habit_checkin()',
    'on_journal_insert()',
    'on_planner_insert()',
    'on_planner_update()',
    'tg_tasks_biu()',
    'tg_planner_biu()',
    'tg_planner_ad()',
    'tg_journal_ad()',
    'tg_habit_checkin_aiu()',
    'tg_habit_checkin_ad()',
    'tg_tasks_aiu()',
    'tg_tasks_ad()',
    'tg_journal_aiu()',
    'tg_planner_aiu()',
    'tg_comment_like_count()',
    'tg_community_creator_admin()',
    'tg_member_count()',
    'tg_post_like_count()',
    'tg_challenge_participant_count()',
    'tg_challenge_max_check()',
    'tg_challenge_log_aggregate()',
    'tg_moderate_chat_msg()',
    'tg_moderate_post()',
    'tg_moderate_comment()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip if not present
      NULL;
    END;
  END LOOP;
END $$;
