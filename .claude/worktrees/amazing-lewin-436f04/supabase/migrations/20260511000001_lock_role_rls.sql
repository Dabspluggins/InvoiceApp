-- Prevent authenticated users from self-escalating their own role.
-- The existing broad update policy allows users to update their profile row,
-- but this restrictive policy blocks any UPDATE that would change the role value.
CREATE POLICY "Users cannot self-escalate role" ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  USING (true)
  WITH CHECK (role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
