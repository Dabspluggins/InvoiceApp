-- 1. Add client_id FK to invoices so the apply endpoint can verify
--    that an invoice belongs to the client whose credit is being drawn.
alter table public.invoices
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists invoices_client_id_idx on public.invoices(client_id);

-- 2. Add currency column to client_credits so balances are never
--    summed across different currencies.
alter table public.client_credits
  add column if not exists currency text not null default 'NGN';

create index if not exists client_credits_currency_idx
  on public.client_credits(client_id, user_id, currency);

-- 3. Allow negative amounts for credit_adjusted rows, which are used as
--    soft-delete reversals.  All other types must still be positive.
alter table public.client_credits
  drop constraint if exists client_credits_amount_check;

alter table public.client_credits
  add constraint client_credits_amount_check
  check (
    (type = 'credit_adjusted') or (amount > 0)
  );

-- 4. Atomic credit-apply RPC.
--    SELECT … FOR UPDATE locks the client/currency ledger rows so that
--    two concurrent requests cannot both pass the balance check before
--    either of them writes, preventing overdraw.
create or replace function apply_client_credit(
  p_client_id  uuid,
  p_invoice_id uuid,
  p_amount     numeric,
  p_user_id    uuid,
  p_currency   text default 'NGN'
) returns numeric
language plpgsql
security definer
as $$
declare
  v_balance        numeric := 0;
  v_row            record;
  v_invoice_number text;
  v_new_balance    numeric;
begin
  -- Lock all ledger rows for this client / user / currency
  for v_row in
    select amount, type
    from   public.client_credits
    where  client_id = p_client_id
      and  user_id   = p_user_id
      and  currency  = p_currency
    for update
  loop
    if    v_row.type = 'credit_added'    then v_balance := v_balance + v_row.amount;
    elsif v_row.type in ('credit_applied', 'credit_refunded')
                                         then v_balance := v_balance - v_row.amount;
    elsif v_row.type = 'credit_adjusted' then v_balance := v_balance + v_row.amount;
    end if;
  end loop;

  if v_balance < p_amount then
    raise exception 'Insufficient credit balance (available: %)', v_balance;
  end if;

  -- Fetch invoice number for the ledger description
  select invoice_number
    into v_invoice_number
  from   public.invoices
  where  id = p_invoice_id;

  -- Insert the debit ledger entry
  insert into public.client_credits
    (user_id, client_id, amount, type, invoice_id, description, currency)
  values (
    p_user_id,
    p_client_id,
    p_amount,
    'credit_applied',
    p_invoice_id,
    'Credit applied to invoice ' || coalesce(v_invoice_number, p_invoice_id::text),
    p_currency
  );

  -- Stamp the invoice with the cumulative credit applied
  update public.invoices
  set    credit_applied = coalesce(credit_applied, 0) + p_amount,
         updated_at     = now()
  where  id = p_invoice_id;

  v_new_balance := v_balance - p_amount;
  return v_new_balance;
end;
$$;
