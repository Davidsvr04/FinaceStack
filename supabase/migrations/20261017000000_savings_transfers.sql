-- =============================================================================
-- FinaceStack - abonos a metas de ahorro como movimientos de cuenta
--
-- Un abono a una meta es una transferencia de una cuenta (bank/cash) hacia la
-- meta: descuenta del saldo de la cuenta pero NO es un gasto. Un retiro es lo
-- contrario. Ambos quedan en transactions con savings_goal_id + transfer_id,
-- así que la analítica (que excluye transfer_id) no los cuenta como
-- ingreso/gasto, y los movimientos conservan la trazabilidad.
--
-- savings_goals.current_amount pasa a mantenerse por trigger, igual que
-- accounts.balance.
-- =============================================================================

alter table public.transactions
  add column savings_goal_id uuid references public.savings_goals (id) on delete set null;

create index transactions_savings_goal_id_idx on public.transactions (savings_goal_id)
  where savings_goal_id is not null;

-- -----------------------------------------------------------------------------
-- Validación: la meta debe ser del mismo usuario y la cuenta no puede ser tarjeta.
-- -----------------------------------------------------------------------------
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

  if exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.type = 'credit_card'
  ) then
    raise exception 'Los ahorros solo se mueven desde o hacia cuentas bancarias o de efectivo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transactions_check_savings_goal
  before insert or update on public.transactions
  for each row execute function public.check_transaction_savings_goal();

-- -----------------------------------------------------------------------------
-- Mantiene savings_goals.current_amount: un 'expense' de la cuenta suma a la
-- meta (abono) y un 'income' resta (retiro).
-- En borrados en cascada (eliminar cuenta o usuario) no se ajusta la meta:
-- el dinero ya ahorrado se queda en ella y se evita violar el check >= 0.
-- -----------------------------------------------------------------------------
create or replace function public.apply_transaction_to_savings_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.savings_goal_id is not null
     and not (tg_op = 'DELETE' and pg_trigger_depth() > 1) then
    update public.savings_goals
       set current_amount = current_amount - case when old.type = 'expense' then old.amount else -old.amount end
     where id = old.savings_goal_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.savings_goal_id is not null then
    update public.savings_goals
       set current_amount = current_amount + case when new.type = 'expense' then new.amount else -new.amount end
     where id = new.savings_goal_id;
  end if;

  return null;
end;
$$;

create trigger transactions_apply_savings_goal
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_to_savings_goal();

-- -----------------------------------------------------------------------------
-- Nuevo RPC de abonos/retiros: ahora exige la cuenta origen/destino.
-- -----------------------------------------------------------------------------
drop function if exists public.add_savings_contribution(uuid, numeric);

-- p_amount > 0 = abono (sale de la cuenta), p_amount < 0 = retiro (entra a la cuenta).
-- Devuelve el id de la transacción creada.
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

revoke execute on function public.add_savings_contribution(uuid, uuid, numeric, date) from public, anon;
grant execute on function public.add_savings_contribution(uuid, uuid, numeric, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Endurecimiento: los saldos (accounts.balance, savings_goals.current_amount)
-- solo los modifican los triggers, nunca el cliente directamente.
-- -----------------------------------------------------------------------------
revoke insert, update on public.accounts from authenticated;
grant insert (user_id, name, type, balance, credit_limit, cut_off_day, payment_due_day, monthly_interest_rate)
  on public.accounts to authenticated;
grant update (name, credit_limit, cut_off_day, payment_due_day, monthly_interest_rate)
  on public.accounts to authenticated;

revoke insert, update on public.savings_goals from authenticated;
grant insert (user_id, name, target_amount, deadline) on public.savings_goals to authenticated;
grant update (name, target_amount, deadline) on public.savings_goals to authenticated;

-- Las transferencias (transfer_id / savings_goal_id) no se reasignan por update.
revoke update on public.transactions from authenticated;
grant update (account_id, category_id, type, amount, date, description)
  on public.transactions to authenticated;
