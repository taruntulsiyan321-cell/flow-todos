-- Lock down new moderation functions
REVOKE EXECUTE ON FUNCTION public.moderation_normalize(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderation_word_regex(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderation_scan(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderation_repeat_offenders(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_moderate_chat_msg() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_moderate_post() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_moderate_comment() FROM PUBLIC, anon, authenticated;