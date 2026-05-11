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
