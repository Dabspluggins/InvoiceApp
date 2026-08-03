-- One row per user; tracks the next invoice number to allocate atomically.
-- Replaces the application-level read-latest-then-increment pattern, which
-- is vulnerable to collisions under concurrent invoice creation.
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  user_id     uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1
);

-- Seed from existing invoices so existing users get correct continuation numbers.
-- Parses the trailing digit run from invoice_number (INV-0042 → 42, next = 43).
-- New users with no invoices get no row here; the RPC handles their first allocation.
INSERT INTO public.invoice_sequences (user_id, next_number)
SELECT
  user_id,
  COALESCE(
    MAX(
      CASE
        WHEN invoice_number ~ '\d+$'
        THEN (regexp_match(invoice_number, '(\d+)$'))[1]::integer
        ELSE 0
      END
    ) + 1,
    1
  ) AS next_number
FROM public.invoices
WHERE user_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
  SET next_number = GREATEST(public.invoice_sequences.next_number, EXCLUDED.next_number);

-- RPC: peek at or allocate the next invoice number for a user.
--
-- p_peek = true  → returns the next number without advancing the counter.
--                  Safe to call multiple times; used by the UI preview route.
-- p_peek = false → atomically allocates and returns the next number.
--                  Use this whenever an invoice is actually being created.
--
-- For new users with no sequence row, the INSERT/ON CONFLICT allocates 1 (INV-0001).
-- The single-statement atomic pattern avoids separate SELECT FOR UPDATE overhead.
CREATE OR REPLACE FUNCTION public.next_invoice_number(
  p_user_id uuid,
  p_prefix  text    DEFAULT 'INV-',
  p_peek    boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  -- Reject calls where the authenticated JWT user does not match p_user_id.
  -- auth.uid() is NULL for service_role callers (cron, admin), which are allowed through.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Sanity-check the prefix to prevent absurdly long invoice numbers.
  IF length(p_prefix) > 20 THEN
    RAISE EXCEPTION 'invalid_prefix: prefix must be 20 characters or fewer';
  END IF;

  IF p_peek THEN
    -- Non-consuming read — return what would be allocated next without changing anything.
    SELECT COALESCE(next_number, 1)
      INTO v_number
      FROM public.invoice_sequences
     WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      v_number := 1;
    END IF;
  ELSE
    -- Atomically increment and capture the allocated number.
    -- Inserting with next_number=2 means RETURNING next_number-1 = 1 on first allocation.
    INSERT INTO public.invoice_sequences (user_id, next_number)
    VALUES (p_user_id, 2)
    ON CONFLICT (user_id) DO UPDATE
      SET next_number = public.invoice_sequences.next_number + 1
    RETURNING next_number - 1 INTO v_number;
  END IF;

  RETURN p_prefix || lpad(v_number::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, text, boolean) FROM PUBLIC;
