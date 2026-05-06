CREATE TRIGGER trg_moderate_post_update
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
WHEN (OLD.body IS DISTINCT FROM NEW.body)
EXECUTE FUNCTION public.tg_moderate_post();

CREATE TRIGGER trg_moderate_comment_update
BEFORE UPDATE ON public.community_post_comments
FOR EACH ROW
WHEN (OLD.body IS DISTINCT FROM NEW.body)
EXECUTE FUNCTION public.tg_moderate_comment();