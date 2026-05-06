
-- Fix challenge_stats_inflation: drop user-writable policy on trigger-computed fields
DROP POLICY IF EXISTS cp_update_self ON public.challenge_participants;

-- Fix progress_log_amount_unbounded: add upper bound on amount
ALTER TABLE public.challenge_progress_logs
  DROP CONSTRAINT IF EXISTS challenge_progress_logs_amount_check;

ALTER TABLE public.challenge_progress_logs
  ADD CONSTRAINT challenge_progress_logs_amount_check
    CHECK (amount > 0 AND amount <= 10000);
