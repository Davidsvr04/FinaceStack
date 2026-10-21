-- =============================================================================
-- FinaceStack - cuentas en dólares
--
-- 1. accounts.currency: cada cuenta es en pesos (COP, por defecto) o en dólares
--    (USD). Todo lo existente (dashboard, tarjetas, metas de ahorro) sigue
--    siendo en pesos; las cuentas en dólares se llevan en un apartado aparte.
--    Las tarjetas de crédito y las metas de ahorro solo admiten pesos.
--
-- 2. Cambio de divisas (comprar o vender dólares): una transferencia entre una
--    cuenta en pesos y una en dólares con montos distintos en cada pata. Ambas
--    patas guardan la tasa (pesos por dólar) en exchange_rate. Como cualquier
--    transferencia, no cuenta como ingreso ni gasto.
--
-- 3. users_profiles.uses_usd: el usuario activa el apartado de dólares; quien
--    solo maneja pesos no lo ve.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Moneda de las cuentas
-- -----------------------------------------------------------------------------
alter table public.accounts
  add column currency text not null default 'COP' check (currency in ('COP', 'USD')),
  add constraint credit_cards_in_cop check (type <> 'credit_card' or currency = 'COP');

create index accounts_user_currency_idx on public.accounts (user_id, currency);

-- La moneda se elige al crear la cuenta y no cambia (los saldos dejarían de cuadrar).
grant insert (currency) on public.accounts to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Cambio de divisas
-- -----------------------------------------------------------------------------
alter table public.transactions
  add column exchange_rate numeric(14, 4) check (exchange_rate > 0);

-- Las metas de ahorro son en pesos: no se abonan ni se retiran en dólares.
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

  if exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.currency <> 'COP'
  ) then
    raise exception 'Las metas de ahorro son en pesos: usa una cuenta en pesos'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Transferencia entre cuentas: ahora exige que ambas sean de la misma moneda.
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

  if v_from.currency <> v_to.currency then
    raise exception 'Las cuentas son de monedas distintas: usa la opción de comprar o vender dólares'
      using errcode = '23514';
  end if;

  insert into public.transactions (account_id, type, amount, date, description, transfer_id)
  values
    (p_from_account_id, 'expense', p_amount, p_date, v_description, v_transfer_id),
    (p_to_account_id,   'income',  p_amount, p_date, v_description, v_transfer_id);

  return v_transfer_id;
end;
$$;

-- Pago de tarjeta: las tarjetas son en pesos, así que el pago sale de una cuenta en pesos.
create or replace function public.pay_credit_card(
  p_card_id          uuid,
  p_from_account_id  uuid,
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
  v_card_type   text;
  v_from        public.accounts;
  v_transfer_id uuid := gen_random_uuid();
  v_description text := coalesce(p_description, 'Pago a tarjeta de crédito');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero' using errcode = '23514';
  end if;

  select type into v_card_type from public.accounts where id = p_card_id;
  select * into v_from from public.accounts where id = p_from_account_id;

  if v_card_type is distinct from 'credit_card' then
    raise exception 'La cuenta destino no es una tarjeta de crédito' using errcode = 'P0002';
  end if;
  if v_from.id is null or v_from.type = 'credit_card' then
    raise exception 'La cuenta origen debe ser bancaria o de efectivo' using errcode = 'P0002';
  end if;
  if v_from.currency <> 'COP' then
    raise exception 'Las tarjetas se pagan desde una cuenta en pesos' using errcode = '23514';
  end if;

  insert into public.transactions (account_id, type, amount, date, description, transfer_id)
  values
    (p_from_account_id, 'expense', p_amount, p_date, v_description, v_transfer_id),
    (p_card_id,         'income',  p_amount, p_date, v_description, v_transfer_id);

  return v_transfer_id;
end;
$$;

-- Compra (pesos -> dólares) o venta (dólares -> pesos) de dólares entre dos
-- cuentas propias. p_from_amount sale de la cuenta origen en su moneda y
-- p_to_amount entra a la de destino en la suya. Devuelve el transfer_id.
create or replace function public.exchange_currency(
  p_from_account_id  uuid,
  p_to_account_id    uuid,
  p_from_amount      numeric,
  p_to_amount        numeric,
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
  v_cop_amount  numeric;
  v_usd_amount  numeric;
  v_rate        numeric;
  v_transfer_id uuid := gen_random_uuid();
  v_description text;
begin
  if p_from_amount is null or p_from_amount <= 0 or p_to_amount is null or p_to_amount <= 0 then
    raise exception 'Los montos deben ser mayores que cero' using errcode = '23514';
  end if;

  select * into v_from from public.accounts where id = p_from_account_id;
  select * into v_to   from public.accounts where id = p_to_account_id;

  if v_from.id is null or v_to.id is null then
    raise exception 'Cuenta no encontrada' using errcode = 'P0002';
  end if;

  if v_from.type = 'credit_card' or v_to.type = 'credit_card' then
    raise exception 'El cambio de divisas es entre cuentas bancarias o de efectivo' using errcode = '23514';
  end if;

  if v_from.currency = v_to.currency then
    raise exception 'Para cambiar divisas una cuenta debe ser en pesos y la otra en dólares'
      using errcode = '23514';
  end if;

  if v_from.currency = 'COP' then
    v_cop_amount := p_from_amount;
    v_usd_amount := p_to_amount;
    v_description := coalesce(nullif(btrim(p_description), ''), 'Compra de dólares');
  else
    v_cop_amount := p_to_amount;
    v_usd_amount := p_from_amount;
    v_description := coalesce(nullif(btrim(p_description), ''), 'Venta de dólares');
  end if;

  -- Pesos por dólar.
  v_rate := round(v_cop_amount / v_usd_amount, 4);

  insert into public.transactions
    (account_id, type, amount, date, description, transfer_id, exchange_rate)
  values
    (p_from_account_id, 'expense', p_from_amount, p_date, v_description, v_transfer_id, v_rate),
    (p_to_account_id,   'income',  p_to_amount,   p_date, v_description, v_transfer_id, v_rate);

  return v_transfer_id;
end;
$$;

revoke execute on function public.exchange_currency(uuid, uuid, numeric, numeric, date, text) from public, anon;
grant execute on function public.exchange_currency(uuid, uuid, numeric, numeric, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Apartado de dólares por usuario
-- -----------------------------------------------------------------------------
alter table public.users_profiles
  add column uses_usd boolean not null default false;

grant update (uses_usd) on public.users_profiles to authenticated;
