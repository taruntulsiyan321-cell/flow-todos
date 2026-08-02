-- time_logs.log_date must be the user's local calendar day from the client.
-- The old default (now AT TIME ZONE 'UTC')::date mis-labels early morning
-- entries in timezones ahead of UTC (e.g. 4:30 AM IST → previous UTC day).

ALTER TABLE public.time_logs
  ALTER COLUMN log_date DROP DEFAULT;

ALTER TABLE public.time_logs
  ALTER COLUMN log_date SET DEFAULT (CURRENT_DATE);

-- Preserve an explicitly provided log_date. Never overwrite it from start_time UTC.
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
  -- If client omitted log_date, fall back to CURRENT_DATE (session TZ),
  -- not (start_time AT TIME ZONE 'UTC') which shifts early-morning logs.
  IF NEW.log_date IS NULL THEN
    NEW.log_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;
