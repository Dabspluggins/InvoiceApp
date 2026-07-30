-- Add optional StockBook product link to line items.
-- When set, this line item will be included in the inventory reservation
-- webhook sent to StockBook on invoice creation / cancellation.
alter table public.line_items
  add column if not exists stockbook_product_id uuid;
