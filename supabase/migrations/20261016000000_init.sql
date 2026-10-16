-- =============================================================================
-- FinaceStack - esquema inicial
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.
--
-- Convención de saldos: accounts.balance es el saldo con signo.
--   * bank / cash  -> positivo = dinero disponible.
--   * credit_card  -> negativo = deuda (un gasto con tarjeta lo hace más negativo,
--                     un pago a la tarjeta lo acerca a 0).
-- Los saldos los mantiene un trigger sobre transactions; no se editan a mano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfiles de usuario y roles
-- -----------------------------------------------------------------------------
create table public.users_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'user' check (role in ('user', 'admin')),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- security definer evita la recursión de RLS al consultar users_profiles
-- desde sus propias políticas.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users_profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Crea el perfil automáticamente al registrarse un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que se registraron antes de esta migración.
insert into public.users_profiles (id, full_name)
select id, raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Cuentas (banco, efectivo, tarjeta de crédito)
-- -----------------------------------------------------------------------------
create table public.accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid()
                           references public.users_profiles (id) on delete cascade,
  name                   text not null,
  type                   text not null check (type in ('bank', 'cash', 'credit_card')),
  balance                numeric(14, 2) not null default 0,
  -- Campos exclusivos de tarjetas de crédito
  credit_limit           numeric(14, 2) check (credit_limit >= 0),
  cut_off_day            smallint check (cut_off_day between 1 and 31),
  payment_due_day        smallint check (payment_due_day between 1 and 31),
  monthly_interest_rate  numeric(6, 4) check (monthly_interest_rate >= 0), -- 0.0215 = 2.15 % mensual
  created_at             timestamptz not null default now(),
  constraint credit_card_fields_only_on_cards check (
    type = 'credit_card'
    or (credit_limit is null and cut_off_day is null
        and payment_due_day is null and monthly_interest_rate is null)
  )
);

create index accounts_user_id_idx on public.accounts (user_id);

-- -----------------------------------------------------------------------------
-- 3. Categorías (user_id null = categoría global del sistema)
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users_profiles (id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income', 'expense')),
  created_at  timestamptz not null default now(),
  unique nulls not distinct (user_id, name, type)
);

create index categories_user_id_idx on public.categories (user_id);

-- -----------------------------------------------------------------------------
-- 4. Transacciones
-- -----------------------------------------------------------------------------
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references public.users_profiles (id) on delete cascade,
  account_id   uuid not null references public.accounts (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  type         text not null check (type in ('income', 'expense')),
  amount       numeric(14, 2) not null check (amount > 0),
  date         date not null default current_date,
  description  text,
  -- Agrupa las dos patas de una transferencia (p. ej. pago a tarjeta).
  -- Las transferencias no cuentan como ingreso/gasto en la analítica.
  transfer_id  uuid,
  created_at   timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_transfer_id_idx on public.transactions (transfer_id)
  where transfer_id is not null;

-- La categoría debe ser visible para el usuario y coincidir con el tipo.
create or replace function public.check_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.categories;
begin
  if new.category_id is null then
    return new;
  end if;

  select * into v_category from public.categories where id = new.category_id;

  if v_category.id is null
     or (v_category.user_id is not null and v_category.user_id <> new.user_id) then
    raise exception 'Categoría no válida' using errcode = '23503';
  end if;

  if v_category.type <> new.type then
    raise exception 'La categoría "%" es de tipo % y la transacción es de tipo %',
      v_category.name, v_category.type, new.type
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transactions_check_category
  before insert or update on public.transactions
  for each row execute function public.check_transaction_category();

-- Mantiene accounts.balance sincronizado con las transacciones.
create or replace function public.apply_transaction_to_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.accounts
       set balance = balance - case when old.type = 'income' then old.amount else -old.amount end
     where id = old.account_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.accounts
       set balance = balance + case when new.type = 'income' then new.amount else -new.amount end
     where id = new.account_id;
  end if;

  return null;
end;
$$;

create trigger transactions_apply_balance
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_to_balance();

-- -----------------------------------------------------------------------------
-- 5. Metas de ahorro
-- -----------------------------------------------------------------------------
create table public.savings_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references public.users_profiles (id) on delete cascade,
  name            text not null,
  target_amount   numeric(14, 2) not null check (target_amount > 0),
  current_amount  numeric(14, 2) not null default 0 check (current_amount >= 0),
  deadline        date,
  created_at      timestamptz not null default now()
);

create index savings_goals_user_id_idx on public.savings_goals (user_id);

-- -----------------------------------------------------------------------------
-- 6. Funciones RPC (security invoker: respetan RLS)
-- -----------------------------------------------------------------------------

-- Abona (monto positivo) o retira (monto negativo) de una meta de ahorro.
create or replace function public.add_savings_contribution(p_goal_id uuid, p_amount numeric)
returns public.savings_goals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.savings_goals;
begin
  update public.savings_goals
     set current_amount = current_amount + p_amount
   where id = p_goal_id
  returning * into v_goal;

  if v_goal.id is null then
    raise exception 'Meta de ahorro no encontrada' using errcode = 'P0002';
  end if;

  return v_goal;
end;
$$;

-- Registra un pago a tarjeta como transferencia: sale de una cuenta bank/cash
-- y reduce la deuda de la tarjeta. Devuelve el transfer_id.
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
  v_from_type   text;
  v_transfer_id uuid := gen_random_uuid();
  v_description text := coalesce(p_description, 'Pago a tarjeta de crédito');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero' using errcode = '23514';
  end if;

  select type into v_card_type from public.accounts where id = p_card_id;
  select type into v_from_type from public.accounts where id = p_from_account_id;

  if v_card_type is distinct from 'credit_card' then
    raise exception 'La cuenta destino no es una tarjeta de crédito' using errcode = 'P0002';
  end if;
  if v_from_type is null or v_from_type = 'credit_card' then
    raise exception 'La cuenta origen debe ser bancaria o de efectivo' using errcode = 'P0002';
  end if;

  insert into public.transactions (account_id, type, amount, date, description, transfer_id)
  values
    (p_from_account_id, 'expense', p_amount, p_date, v_description, v_transfer_id),
    (p_card_id,         'income',  p_amount, p_date, v_description, v_transfer_id);

  return v_transfer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.users_profiles enable row level security;
alter table public.accounts       enable row level security;
alter table public.categories     enable row level security;
alter table public.transactions   enable row level security;
alter table public.savings_goals  enable row level security;

-- users_profiles: cada usuario ve su perfil; el admin ve todos.
-- El rol solo se cambia desde el backend con la secret key (ver grants abajo).
create policy "profiles_select_own_or_admin" on public.users_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles_update_own" on public.users_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- accounts
create policy "accounts_all_own" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- categories: globales de solo lectura + propias editables
create policy "categories_select_global_or_own" on public.categories
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories_update_own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- transactions: propias, y la cuenta también debe ser propia
create policy "transactions_select_own" on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "transactions_insert_own" on public.transactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

create policy "transactions_delete_own" on public.transactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- savings_goals
create policy "savings_goals_all_own" on public.savings_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 8. Privilegios
-- -----------------------------------------------------------------------------
revoke all on public.users_profiles, public.accounts, public.categories,
              public.transactions, public.savings_goals
  from anon;

grant select, insert, update, delete
  on public.accounts, public.categories, public.transactions, public.savings_goals
  to authenticated;

-- El usuario solo puede editar su nombre, nunca su rol.
revoke insert, update, delete on public.users_profiles from authenticated;
grant select on public.users_profiles to authenticated;
grant update (full_name) on public.users_profiles to authenticated;

revoke execute on function public.add_savings_contribution(uuid, numeric) from public, anon;
revoke execute on function public.pay_credit_card(uuid, uuid, numeric, date, text) from public, anon;
grant execute on function public.add_savings_contribution(uuid, numeric) to authenticated;
grant execute on function public.pay_credit_card(uuid, uuid, numeric, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Datos semilla: categorías globales
-- -----------------------------------------------------------------------------
insert into public.categories (user_id, name, type) values
  (null, 'Salario',          'income'),
  (null, 'Ventas',           'income'),
  (null, 'Inversiones',      'income'),
  (null, 'Otros ingresos',   'income'),
  (null, 'Alimentación',     'expense'),
  (null, 'Vivienda',         'expense'),
  (null, 'Transporte',       'expense'),
  (null, 'Servicios',        'expense'),
  (null, 'Salud',            'expense'),
  (null, 'Educación',        'expense'),
  (null, 'Entretenimiento',  'expense'),
  (null, 'Ropa',             'expense'),
  (null, 'Otros gastos',     'expense');

-- -----------------------------------------------------------------------------
-- Para promover el primer administrador (ejecutar manualmente):
--   update public.users_profiles set role = 'admin' where id = '<uuid-del-usuario>';
-- -----------------------------------------------------------------------------
