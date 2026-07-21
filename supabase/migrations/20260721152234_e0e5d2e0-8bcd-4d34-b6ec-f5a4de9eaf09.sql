
CREATE TABLE public.time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity TEXT NOT NULL,
  category TEXT,
  log_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX time_logs_user_date_idx ON public.time_logs(user_id, log_date DESC, start_time DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_logs TO authenticated;
GRANT ALL ON public.time_logs TO service_role;

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tl_select_own" ON public.time_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tl_insert_own" ON public.time_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tl_update_own" ON public.time_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tl_delete_own" ON public.time_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_time_logs_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.end_time IS NOT NULL AND NEW.duration_minutes IS NULL THEN
    NEW.duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::int / 60);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_logs_biu
BEFORE INSERT OR UPDATE ON public.time_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_time_logs_touch();
