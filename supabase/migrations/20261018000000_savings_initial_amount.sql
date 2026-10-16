-- =============================================================================
-- FinaceStack - ahorro previo en metas
--
-- initial_amount: dinero que el usuario ya tenía ahorrado antes de usar la app.
-- Suma a current_amount pero no sale de ninguna cuenta ni genera movimiento.
-- current_amount = initial_amount + abonos - retiros (estos vía trigger de
-- transactions).
-- =============================================================================

alter table public.savings_goals
  add column initial_amount numeric(14, 2) not null default 0 check (initial_amount >= 0);

-- Al crear la meta, el acumulado arranca en el ahorro previo.
-- Al cambiar el ahorro previo, el acumulado se ajusta por la diferencia
-- (el check current_amount >= 0 impide bajarlo por debajo de lo retirado).
create or replace function public.apply_savings_initial_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.current_amount := new.initial_amount;
  elsif new.initial_amount is distinct from old.initial_amount then
    new.current_amount := new.current_amount + (new.initial_amount - old.initial_amount);
  end if;
  return new;
end;
$$;

create trigger savings_goals_apply_initial_amount
  before insert or update on public.savings_goals
  for each row execute function public.apply_savings_initial_amount();

-- El cliente puede fijar el ahorro previo; current_amount sigue siendo solo de triggers.
grant insert (initial_amount) on public.savings_goals to authenticated;
grant update (initial_amount) on public.savings_goals to authenticated;
