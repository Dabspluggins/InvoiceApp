-- Extends get_invoice_summary() to return primary_currency and has_mixed_currencies.
--
-- primary_currency: the currency used in the most invoices (tie-broken alphabetically).
--                   NULL when the user has no invoices.
-- has_mixed_currencies: true when the user has invoices in more than one currency.
--
-- These fields let the dashboard stat cards show the correct currency symbol for
-- single-currency accounts and a neutral "Multiple currencies" label for mixed ones,
-- without deriving currency from the paginated invoice list (which would be a
-- data-source mismatch against the RPC-aggregated totals).

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
    ),
    'primary_currency', (
      SELECT currency
      FROM invoices
      WHERE user_id = auth.uid()
      GROUP BY currency
      ORDER BY COUNT(*) DESC, currency ASC
      LIMIT 1
    ),
    'has_mixed_currencies', (
      SELECT COUNT(DISTINCT currency) > 1
      FROM invoices
      WHERE user_id = auth.uid()
    )
  )
$$;

-- No permission changes needed — the original migration already set them correctly.
