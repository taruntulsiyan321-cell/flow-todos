CREATE TABLE public.notepad_todos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notepad_todos TO authenticated;
GRANT ALL ON public.notepad_todos TO service_role;

ALTER TABLE public.notepad_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notepad own select" ON public.notepad_todos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notepad own insert" ON public.notepad_todos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notepad own update" ON public.notepad_todos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notepad own delete" ON public.notepad_todos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notepad_todos_user_idx ON public.notepad_todos (user_id, completed, sort_order);

CREATE OR REPLACE FUNCTION public.tg_notepad_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.completed AND NOT COALESCE(OLD.completed, false) THEN
    NEW.completed_at = now();
  ELSIF NOT NEW.completed THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notepad_touch BEFORE UPDATE ON public.notepad_todos
FOR EACH ROW EXECUTE FUNCTION public.tg_notepad_touch();