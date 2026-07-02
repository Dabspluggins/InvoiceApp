-- get_invoice_summary()
-- Returns total invoice count, total paid amount, and total outstanding amount
-- for the calling user. Computed server-side so it covers the full invoice
-- history regardless of pagination on the client.
--
-- paid_amount  = sum of `total` for paid invoices
--              + sum of payments recorded + credit_applied for partial invoices
-- outstanding  = sum of `total` for sent/pending invoices
--              + remaining unpaid balance for partial invoices

CREATE OR REPLACE FUNCTION get_invoice_summary()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_count', (
      SELECT COUNT(*)
      FROM invoices
      WHERE user_id = auth.uid()
    ),
    'paid_amount', (
      SELECT COALESCE(SUM(
        CASE
          WHEN i.status = 'paid' THEN i.total
          WHEN i.status = 'partial' THEN
            COALESCE(
              (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = i.user_id),
              0
            ) + COALESCE(i.credit_applied, 0)
          ELSE 0
        END
      ), 0)
      FROM invoices i
      WHERE i.user_id = auth.uid()
    ),
    'outstanding_amount', (
      SELECT COALESCE(SUM(
        CASE
          WHEN i.status IN ('sent', 'pending') THEN i.total
          WHEN i.status = 'partial' THEN
            GREATEST(
              0,
              i.total
                - COALESCE(
                    (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.user_id = i.user_id),
                    0
                  )
                - COALESCE(i.credit_applied, 0)
            )
          ELSE 0
        END
      ), 0)
      FROM invoices i
      WHERE i.user_id = auth.uid()
    )
  )
$$;

-- Lock down execute: revoke from PUBLIC first, then grant only to authenticated.
-- SECURITY DEFINER functions are callable by PUBLIC by default in PostgreSQL,
-- which would bypass the auth.uid() guard entirely.
REVOKE EXECUTE ON FUNCTION public.get_invoice_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary() TO authenticated;
