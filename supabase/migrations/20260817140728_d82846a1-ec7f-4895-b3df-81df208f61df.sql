ALTER TABLE public.daily_todos ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS daily_todos_goal_id_idx ON public.daily_todos(goal_id);
CREATE INDEX IF NOT EXISTS goals_parent_id_idx ON public.goals(parent_id);