ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_token_expires_at TIMESTAMPTZ;

UPDATE clients
  SET portal_token_expires_at = NOW() + INTERVAL '90 days'
  WHERE portal_token_expires_at IS NULL;
