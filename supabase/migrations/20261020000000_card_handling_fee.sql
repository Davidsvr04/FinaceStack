-- =============================================================================
-- FinaceStack - cuota de manejo automática en tarjetas de crédito
--
-- Cada tarjeta puede tener una cuota de manejo (valor + día del mes). Una
-- función genera el gasto en cada fecha de cobro y un job diario de pg_cron la
-- ejecuta. card_fee_charges registra qué meses ya se cobraron: así no hay
-- duplicados y, si el usuario elimina un cobro, no se vuelve a crear.
-- =============================================================================

alter table public.accounts
  add column handling_fee_amount numeric(14, 2) check (handling_fee_amount > 0),
  add column handling_fee_day smallint check (handling_fee_day between 1 and 31),
  -- Primera fecha de cobro a registrar (no se generan cobros anteriores).
  add column handling_fee_start date,
  add constraint handling_fee_only_on_cards check (
    type = 'credit_card'
    or (handling_fee_amount is null and handling_fee_day is null and handling_fee_start is null)
  ),
  add constraint handling_fee_complete check (
    handling_fee_amount is null or (handling_fee_day is not null and handling_fee_start is not null)
  );

grant insert (handling_fee_amount, handling_fee_day, handling_fee_start) on public.accounts to authenticated;
grant update (handling_fee_amount, handling_fee_day, handling_fee_start) on public.accounts to authenticated;

-- Categoría global para estos cobros.
insert into public.categories (user_id, name, type)
values (null, 'Cuota de manejo', 'expense')
on conflict do nothing;

-- Meses ya cobrados por tarjeta. Solo lo usa la función (sin políticas = sin acceso desde el cliente).
create table public.card_fee_charges (
  account_id      uuid not null references public.accounts (id) on delete cascade,
  period          date not null, -- primer día del mes cobrado
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (account_id, period)
);

alter table public.card_fee_charges enable row level security;

-- Genera los cobros pendientes hasta p_today (incluido). Idempotente.
-- p_account_id null = todas las tarjetas (uso del job diario).
create or replace function public.generate_handling_fees(
  p_account_id uuid default null,
  p_today      date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card      record;
  v_category  uuid;
  v_period    date;
  v_last_day  integer;
  v_fee_date  date;
  v_tx_id     uuid;
  v_count     integer := 0;
begin
  select id into v_category
  from public.categories
  where user_id is null and name = 'Cuota de manejo' and type = 'expense';

  for v_card in
    select id, user_id, handling_fee_amount, handling_fee_day, handling_fee_start
    from public.accounts
    where type = 'credit_card'
      and handling_fee_amount is not null
      and handling_fee_start <= p_today
      and (p_account_id is null or id = p_account_id)
  loop
    v_period := date_trunc('month', v_card.handling_fee_start)::date;

    while v_period <= p_today loop
      -- Día de cobro ajustado a meses cortos (31 -> 30/28).
      v_last_day := extract(day from (v_period + interval '1 month' - interval '1 day'))::integer;
      v_fee_date := v_period + (least(v_card.handling_fee_day, v_last_day) - 1);

      if v_fee_date >= v_card.handling_fee_start
         and v_fee_date <= p_today
         and not exists (
           select 1 from public.card_fee_charges c
           where c.account_id = v_card.id and c.period = v_period
         ) then
        insert into public.transactions (user_id, account_id, category_id, type, amount, date, description)
        values (v_card.user_id, v_card.id, v_category, 'expense', v_card.handling_fee_amount, v_fee_date, 'Cuota de manejo')
        returning id into v_tx_id;

        insert into public.card_fee_charges (account_id, period, transaction_id)
        values (v_card.id, v_period, v_tx_id);

        v_count := v_count + 1;
      end if;

      v_period := (v_period + interval '1 month')::date;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Solo el job y el backend (secret key) pueden ejecutarla.
revoke execute on function public.generate_handling_fees(uuid, date) from public, anon, authenticated;
grant execute on function public.generate_handling_fees(uuid, date) to service_role;

-- Job diario a las 06:00 de Colombia (11:00 UTC).
create extension if not exists pg_cron;

select cron.schedule(
  'finacestack-cuotas-de-manejo',
  '0 11 * * *',
  $$select public.generate_handling_fees(null, (now() at time zone 'America/Bogota')::date)$$
);
