-- =============================================================================
-- FinaceStack - transferencias entre cuentas, pago de tarjeta desde ahorros y
-- plantillas de movimientos.
--
-- 1. Transferencia entre cuentas (bank/cash): dos movimientos enlazados por
--    transfer_id (sale de una cuenta, entra en la otra). No es ingreso ni gasto.
--
-- 2. Pago de tarjeta desde una meta de ahorro: un solo movimiento de ingreso en
--    la tarjeta (baja la deuda) enlazado a la meta (baja lo ahorrado). Los
--    triggers existentes ajustan ambos saldos. Para eso, el trigger de metas
--    pasa a aceptar tarjetas solo cuando el movimiento es un pago (ingreso).
--
-- 3. Plantillas de movimientos frecuentes (transporte, mercado...) para
--    precargar el formulario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Transferencia entre cuentas
-- -----------------------------------------------------------------------------
create or replace function public.transfer_between_accounts(
  p_from_account_id  uuid,
  p_to_account_id    uuid,
  p_amount           numeric,
  p_date             date default current_date,
  p_description      text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from        public.accounts;
  v_to          public.accounts;
  v_transfer_id uuid := gen_random_uuid();
  v_description text := coalesce(nullif(btrim(p_description), ''), 'Transferencia entre cuentas');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero' using errcode = '23514';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'La cuenta de origen y la de destino deben ser distintas' using errcode = '23514';
  end if;

  select * into v_from from public.accounts where id = p_from_account_id;
  select * into v_to   from public.accounts where id = p_to_account_id;

  if v_from.id is null or v_to.id is null then
    raise exception 'Cuenta no encontrada' using errcode = 'P0002';
  end if;

  if v_from.type = 'credit_card' or v_to.type = 'credit_card' then
    raise exception 'Para pagar una tarjeta usa la opción de pago en Tarjetas' using errcode = '23514';
  end if;

  insert into public.transactions (account_id, type, amount, date, description, transfer_id)
  values
    (p_from_account_id, 'expense', p_amount, p_date, v_description, v_transfer_id),
    (p_to_account_id,   'income',  p_amount, p_date, v_description, v_transfer_id);

  return v_transfer_id;
end;
$$;

revoke execute on function public.transfer_between_accounts(uuid, uuid, numeric, date, text) from public, anon;
grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Pago de tarjeta desde una meta de ahorro
-- -----------------------------------------------------------------------------

-- Las metas siguen sin poder gastar con tarjeta ni "ahorrar" en ella: la tarjeta
-- solo puede enlazarse a una meta cuando el movimiento es un pago (ingreso).
create or replace function public.check_transaction_savings_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.savings_goal_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.savings_goals g
    where g.id = new.savings_goal_id and g.user_id = new.user_id
  ) then
    raise exception 'Meta de ahorro no válida' using errcode = '23503';
  end if;

  if new.type = 'expense' and exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.type = 'credit_card'
  ) then
    raise exception 'Los ahorros solo se mueven desde o hacia cuentas bancarias o de efectivo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Abonos y retiros de metas: nunca con tarjetas (el pago de tarjeta tiene su propio RPC).
create or replace function public.add_savings_contribution(
  p_goal_id     uuid,
  p_account_id  uuid,
  p_amount      numeric,
  p_date        date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal  public.savings_goals;
  v_tx_id uuid;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'El monto no puede ser cero' using errcode = '23514';
  end if;

  select * into v_goal from public.savings_goals where id = p_goal_id;
  if v_goal.id is null then
    raise exception 'Meta de ahorro no encontrada' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.accounts where id = p_account_id and type = 'credit_card') then
    raise exception 'Los ahorros solo se mueven desde o hacia cuentas bancarias o de efectivo'
      using errcode = '23514';
  end if;

  if p_amount < 0 and v_goal.current_amount + p_amount < 0 then
    raise exception 'No puedes retirar más de lo ahorrado en la meta' using errcode = '23514';
  end if;

  insert into public.transactions
    (account_id, type, amount, date, description, transfer_id, savings_goal_id)
  values (
    p_account_id,
    case when p_amount > 0 then 'expense' else 'income' end,
    abs(p_amount),
    p_date,
    case when p_amount > 0 then 'Abono a meta: ' else 'Retiro de meta: ' end || v_goal.name,
    gen_random_uuid(),
    p_goal_id
  )
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- Paga la tarjeta con dinero de una meta: baja la deuda de la tarjeta y lo ahorrado.
create or replace function public.pay_credit_card_from_goal(
  p_card_id      uuid,
  p_goal_id      uuid,
  p_amount       numeric,
  p_date         date default current_date,
  p_description  text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_type text;
  v_goal      public.savings_goals;
  v_tx_id     uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero' using errcode = '23514';
  end if;

  select type into v_card_type from public.accounts where id = p_card_id;
  if v_card_type is distinct from 'credit_card' then
    raise exception 'La cuenta destino no es una tarjeta de crédito' using errcode = 'P0002';
  end if;

  select * into v_goal from public.savings_goals where id = p_goal_id;
  if v_goal.id is null then
    raise exception 'Meta de ahorro no encontrada' using errcode = 'P0002';
  end if;

  if v_goal.current_amount < p_amount then
    raise exception 'No puedes pagar más de lo ahorrado en la meta' using errcode = '23514';
  end if;

  insert into public.transactions
    (account_id, type, amount, date, description, transfer_id, savings_goal_id)
  values (
    p_card_id,
    'income',
    p_amount,
    p_date,
    coalesce(nullif(btrim(p_description), ''), 'Pago de tarjeta con ahorro: ' || v_goal.name),
    gen_random_uuid(),
    p_goal_id
  )
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

revoke execute on function public.pay_credit_card_from_goal(uuid, uuid, numeric, date, text) from public, anon;
grant execute on function public.pay_credit_card_from_goal(uuid, uuid, numeric, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Plantillas de movimientos frecuentes
-- -----------------------------------------------------------------------------
create table public.movement_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references public.users_profiles (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  type         text not null check (type in ('income', 'expense')),
  -- Opcional: gastos como el transporte varían, y se escribe el monto al usarla.
  amount       numeric(14, 2) check (amount > 0),
  account_id   uuid references public.accounts (id) on delete set null,
  category_id  uuid references public.categories (id) on delete set null,
  description  text,
  installments smallint not null default 1 check (installments between 1 and 48),
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

create index movement_templates_user_id_idx on public.movement_templates (user_id);

alter table public.movement_templates enable row level security;

create policy "templates_select_own" on public.movement_templates
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "templates_insert_own" on public.movement_templates
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())
    ))
  );

create policy "templates_update_own" on public.movement_templates
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())
    ))
  );

create policy "templates_delete_own" on public.movement_templates
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.movement_templates from anon;
grant select, delete on public.movement_templates to authenticated;
grant insert (user_id, name, type, amount, account_id, category_id, description, installments)
  on public.movement_templates to authenticated;
grant update (name, type, amount, account_id, category_id, description, installments)
  on public.movement_templates to authenticated;
