-- Add role column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- Grant admin to the founder
UPDATE public.profiles
  SET role = 'admin'
  WHERE id = (
    SELECT id FROM auth.users WHERE email = 'enyinnayadaberechi@gmail.com' LIMIT 1
  );

-- Prevent authenticated users from updating their own role column
-- The existing broad update policy allows users to update their profile row,
-- but we must ensure role cannot be self-escalated.
CREATE POLICY "Users cannot self-escalate role" ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  USING (true)
  WITH CHECK (role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
