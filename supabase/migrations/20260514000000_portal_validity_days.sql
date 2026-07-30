ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_validity_days integer NOT NULL DEFAULT 30
  CHECK (portal_validity_days IN (30, 60, 90, 180));
