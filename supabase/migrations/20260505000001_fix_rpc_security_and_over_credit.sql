-- Replace apply_client_credit with a security-hardened version that:
--   1. Verifies the JWT caller matches p_user_id (prevents privilege escalation)
--   2. Locks and validates invoice ownership, client linkage, and currency
--   3. Checks existing credit_applied so partial saves cannot over-credit
create or replace function apply_client_credit(
  p_client_id  uuid,
  p_invoice_id uuid,
  p_amount     numeric,
  p_user_id    uuid,
  p_currency   text default 'NGN'
) returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance        numeric := 0;
  v_row            record;
  v_invoice        record;
  v_new_balance    numeric;
  v_remaining      numeric;
begin
  -- Guard: caller must be the authenticated user they claim to be
  if auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorized';
  end if;

  -- Lock the invoice row to prevent concurrent updates
  select id, user_id, client_id, currency, total, credit_applied, invoice_number
    into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_invoice.user_id <> p_user_id then
    raise exception 'Invoice does not belong to this user';
  end if;

  if v_invoice.client_id is not null and v_invoice.client_id <> p_client_id then
    raise exception 'Invoice does not belong to this client';
  end if;

  if v_invoice.currency <> p_currency then
    raise exception 'Invoice currency does not match credit currency';
  end if;

  -- Verify client belongs to user
  perform 1 from public.clients
  where id = p_client_id and user_id = p_user_id;
  if not found then
    raise exception 'Client not found';
  end if;

  -- Over-credit guard: amount + existing credit_applied must not exceed invoice total
  v_remaining := coalesce(v_invoice.total, 0) - coalesce(v_invoice.credit_applied, 0);
  if p_amount > v_remaining then
    raise exception 'Credit amount exceeds remaining invoice balance (remaining: %)', v_remaining;
  end if;

  -- Lock all ledger rows for this client / user / currency to compute balance
  for v_row in
    select amount, type
    from public.client_credits
    where client_id = p_client_id
      and user_id   = p_user_id
      and currency  = p_currency
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

  -- Insert the debit ledger entry
  insert into public.client_credits
    (user_id, client_id, amount, type, invoice_id, description, currency)
  values (
    p_user_id,
    p_client_id,
    p_amount,
    'credit_applied',
    p_invoice_id,
    'Credit applied to invoice ' || coalesce(v_invoice.invoice_number, p_invoice_id::text),
    p_currency
  );

  -- Stamp the invoice with the cumulative credit applied
  update public.invoices
  set credit_applied = coalesce(credit_applied, 0) + p_amount,
      updated_at     = now()
  where id = p_invoice_id;

  v_new_balance := v_balance - p_amount;
  return v_new_balance;
end;
$$;
