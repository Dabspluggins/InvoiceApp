-- Realign invoice_sequences after production ran Jul 27 code (7292a2d) until 2026-09-15.
--
-- Vercel's Production environment tracked `master` while the repo default moved to
-- `main`, so production served a pre-Aug build for ~7 weeks. That build generates
-- invoice numbers directly from the invoices table and never calls
-- next_invoice_number, so invoice_sequences.next_number never advanced while real
-- invoice numbers kept climbing. The first promotion of `main` allocated a number
-- that already existed, violating invoices_user_invoice_number_idx
-- (Postgres 23505 -> PostgREST HTTP 409). Invoice creation and the recurring cron
-- both failed in production and the deploy was rolled back.
--
-- Observed drift when written:
--   19cf8377...  66 invoices, highest INV-0066, next_number  28 -> 67
--   f2e81807... 210 invoices, highest INV-0213, next_number 200 -> 214
--   726d8bfc...  31 invoices, highest INV-0032, next_number  22 -> 33
--   aba1e4a5...   9 invoices, highest INV-0009, next_number   7 -> 10
--   cdb16109...   3 invoices, highest INV-0003, next_number   2 -> 4
--
-- Safety:
--  * next_number means "next to allocate" — verified against five undrifted users
--    in production (1 invoice -> 2, 3 -> 4, 7 -> 8, 14 -> 15).
--  * Extraction takes the TRAILING digit group, not all digits stripped of
--    non-digits. A number formatted INV-2026-0001 would otherwise yield 20260001
--    and advance the counter catastrophically. Verified: every production row
--    matches '^\D*\d+$'.
--  * GREATEST() means a counter can never move backwards, so this is idempotent
--    and safe to re-run.
--  * Was safe to apply before deploying `main`: the build deployed at the time
--    never read invoice_sequences. APPLIED 2026-09-15 and recorded in
--    supabase_migrations.schema_migrations. `main` is now deployed and does
--    read invoice_sequences; re-running remains safe because GREATEST only
--    moves counters forward. Verified clean 2026-09-24: no counter at or below
--    a used number, no user with invoices but no counter row, and every
--    invoice_number still ends in a digit.
--  * Custom prefixes (e.g. INVMitt-0001) share the same per-user counter;
--    invoice_sequences has no prefix column, so extraction is prefix-agnostic.

begin;

-- Users with invoices but no counter row would start from the table default and
-- collide immediately.
insert into invoice_sequences (user_id, next_number)
select i.user_id,
       max((regexp_match(i.invoice_number, '(\d+)$'))[1]::bigint) + 1
from invoices i
where i.invoice_number ~ '\d$'
  and not exists (select 1 from invoice_sequences s where s.user_id = i.user_id)
group by i.user_id
on conflict (user_id) do nothing;

-- Advance any counter sitting at or below a number already in use.
update invoice_sequences s
set next_number = greatest(s.next_number, used.max_num + 1)
from (
    select i.user_id,
           max((regexp_match(i.invoice_number, '(\d+)$'))[1]::bigint) as max_num
    from invoices i
    where i.invoice_number ~ '\d$'
    group by i.user_id
) as used
where used.user_id = s.user_id
  and s.next_number <= used.max_num;

-- Abort rather than leave the table half-fixed.
do $$
declare remaining int;
begin
    select count(*) into remaining
      from invoice_sequences s
      join (
            select i.user_id,
                   max((regexp_match(i.invoice_number, '(\d+)$'))[1]::bigint) as max_num
            from invoices i
            where i.invoice_number ~ '\d$'
            group by i.user_id
      ) used on used.user_id = s.user_id
     where s.next_number <= used.max_num;

    if remaining > 0 then
        raise exception
          'invoice_sequences reconciliation failed: % user(s) still have a counter at or below a used invoice number',
          remaining;
    end if;

    raise notice 'invoice_sequences reconciliation complete: no remaining collisions';
end $$;

commit;
