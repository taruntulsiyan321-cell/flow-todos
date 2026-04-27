-- Revoke direct execute from anon/authenticated for SECURITY DEFINER helpers
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.award_xp(uuid, integer) from anon, authenticated, public;
revoke execute on function public.on_habit_checkin() from anon, authenticated, public;
revoke execute on function public.on_task_update() from anon, authenticated, public;
revoke execute on function public.on_task_insert() from anon, authenticated, public;
revoke execute on function public.calc_level(integer) from anon, authenticated, public;