-- Lock down record_invoice_view(), which has been executable by PUBLIC since
-- it was introduced in 20260507000000_record_invoice_view_rpc.sql.
--
-- The function is SECURITY DEFINER and PostgreSQL grants EXECUTE to PUBLIC by
-- default. Anyone holding an invoice share token could therefore call it
-- directly through PostgREST, pushing view_count past 1. The function reports
-- "first view" only when the new count is exactly 1, so the invoice owner's
-- "your invoice was opened" email would then never be sent for that invoice.
--
-- The only caller is recordView() in src/app/i/[token]/page.tsx, which uses
-- the server-side service-role client, so no browser role needs EXECUTE here.
--
-- Same lockdown applied to record_estimate_client_view() in
-- 20260921000000_estimate_client_view_idempotency.sql.

REVOKE ALL ON FUNCTION public.record_invoice_view(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_invoice_view(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_view(text) TO service_role;
