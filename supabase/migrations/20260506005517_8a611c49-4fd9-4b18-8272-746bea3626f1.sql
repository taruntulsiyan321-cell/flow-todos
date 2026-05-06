-- Make immutability of chat messages explicit and tamper-proof.
-- A RESTRICTIVE policy with USING (false) ensures NO update can ever succeed,
-- even if a permissive UPDATE policy is added later by mistake.
CREATE POLICY cm_no_updates
  ON public.community_messages
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);
