-- =============================================================================
-- FinaceStack - compras a cuotas y plan de la deuda inicial de tarjetas
--
-- 1. transactions.installments: una compra con tarjeta puede diferirse a N
--    cuotas; cada cuota se factura en un corte distinto. El saldo de la tarjeta
--    (accounts.balance) sigue reflejando la deuda total.
--
-- 2. Plan de la deuda inicial de una tarjeta (lo que se debía al registrarla):
--    - opening_billed_debt: ya facturado (extracto cerrado sin pagar).
--    - opening_next_charge: cuánto del resto se cobra en el próximo extracto
--      (null = todo).
--    - opening_later_installments: en cuántos meses se cobra lo que queda.
-- =============================================================================

alter table public.transactions
  add column installments smallint not null default 1 check (installments between 1 and 48);

alter table public.accounts
  add column opening_billed_debt numeric(14, 2) not null default 0 check (opening_billed_debt >= 0),
  add column opening_next_charge numeric(14, 2) check (opening_next_charge >= 0),
  add column opening_later_installments smallint not null default 1
    check (opening_later_installments between 1 and 48);

-- Solo los gastos con tarjeta de crédito pueden ir a cuotas.
create or replace function public.check_transaction_installments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.installments <= 1 then
    return new;
  end if;

  if new.type <> 'expense' or new.transfer_id is not null then
    raise exception 'Solo los gastos pueden diferirse a cuotas' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.type = 'credit_card'
  ) then
    raise exception 'Las cuotas solo aplican a compras con tarjeta de crédito' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transactions_check_installments
  before insert or update on public.transactions
  for each row execute function public.check_transaction_installments();

grant update (installments) on public.transactions to authenticated;

grant insert (opening_billed_debt, opening_next_charge, opening_later_installments)
  on public.accounts to authenticated;
grant update (opening_billed_debt, opening_next_charge, opening_later_installments)
  on public.accounts to authenticated;
