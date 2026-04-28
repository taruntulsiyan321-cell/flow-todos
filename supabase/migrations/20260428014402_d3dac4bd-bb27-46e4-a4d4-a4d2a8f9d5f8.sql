
REVOKE EXECUTE ON FUNCTION public.tg_habit_checkin_aiu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_habit_checkin_ad() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_tasks_biu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_tasks_aiu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_tasks_ad() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_journal_aiu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_journal_ad() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_planner_biu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_planner_aiu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_planner_ad() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_stats(uuid) FROM PUBLIC, anon, authenticated;
