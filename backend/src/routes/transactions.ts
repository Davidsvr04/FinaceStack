import type { SupabaseClient } from '@supabase/supabase-js'
import { Router } from 'express'
import { z } from 'zod'
import { ONE_ROW_PER_TRANSFER } from '../lib/finance.js'
import { dbError, getCtx, HttpError, isoDate, money, parse, uuidParam } from '../lib/http.js'

const router = Router()

const SELECT =
  '*, account:accounts(id, name, type), category:categories(id, name, type), savings_goal:savings_goals(id, name)'

const createSchema = z.object({
  account_id: z.uuid(),
  category_id: z.uuid().nullable().optional(),
  type: z.enum(['income', 'expense']),
  amount: money,
  date: isoDate.optional(),
  description: z.string().trim().max(255).nullable().optional(),
  // Solo gastos con tarjeta de crédito (lo valida la base de datos).
  installments: z.coerce.number().int().min(1).max(48).optional(),
})

// Pasar dinero entre dos cuentas propias (banco/efectivo): no es ingreso ni gasto.
const transferSchema = z.object({
  from_account_id: z.uuid(),
  to_account_id: z.uuid(),
  amount: money,
  date: isoDate.optional(),
  description: z.string().trim().max(255).optional(),
})

const listSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  // income/expense = movimientos reales; transfer = pagos a tarjeta y ahorros.
  kind: z.enum(['income', 'expense', 'transfer']).optional(),
  account_id: z.uuid().optional(),
  category_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const filters = parse(listSchema, req.query)

  let query = supabase
    .from('transactions')
    .select(SELECT, { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.kind === 'transfer') query = query.not('transfer_id', 'is', null)
  else if (filters.kind) query = query.eq('type', filters.kind).is('transfer_id', null)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.account_id) query = query.eq('account_id', filters.account_id)
  else query = query.or(ONE_ROW_PER_TRANSFER)

  const { data, error, count } = await query
  if (error) throw dbError(error)

  res.json({ data: await withCounterparts(supabase, data), total: count ?? 0 })
})

/** Añade counterpart_account (la otra cuenta) a las transferencias entre cuentas. */
async function withCounterparts<T extends { id: string; transfer_id: string | null; savings_goal_id: string | null }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<(T & { counterpart_account: unknown })[]> {
  const transferIds = [
    ...new Set(rows.filter((r) => r.transfer_id && !r.savings_goal_id).map((r) => r.transfer_id!)),
  ]
  if (transferIds.length === 0) return rows.map((r) => ({ ...r, counterpart_account: null }))

  const { data: legs, error } = await supabase
    .from('transactions')
    .select('id, transfer_id, account:accounts(id, name, type)')
    .in('transfer_id', transferIds)
  if (error) throw dbError(error)

  return rows.map((row) => ({
    ...row,
    counterpart_account:
      legs.find((leg) => leg.transfer_id === row.transfer_id && leg.id !== row.id)?.account ?? null,
  }))
}

router.post('/transfer', async (req, res) => {
  const { supabase } = getCtx(req)
  const input = parse(transferSchema, req.body)

  const { data: transferId, error } = await supabase.rpc('transfer_between_accounts', {
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount: input.amount,
    ...(input.date && { p_date: input.date }),
    ...(input.description && { p_description: input.description }),
  })

  if (error) throw dbError(error)
  res.status(201).json({ transfer_id: transferId })
})

router.post('/', async (req, res) => {
  const { supabase, userId } = getCtx(req)
  const input = parse(createSchema, req.body)

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...input, user_id: userId })
    .select(SELECT)
    .single()

  if (error) throw dbError(error)
  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(createSchema.partial(), req.body)

  // Las patas de una transferencia se gestionan juntas (borrar y recrear).
  const { data: current, error: findError } = await supabase
    .from('transactions')
    .select('transfer_id')
    .eq('id', id)
    .single()
  if (findError) throw dbError(findError)
  if (current.transfer_id) {
    throw new HttpError(409, 'Las transferencias no se pueden editar; elimínala y regístrala de nuevo')
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(input)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw dbError(error)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)

  const { data: current, error: findError } = await supabase
    .from('transactions')
    .select('transfer_id')
    .eq('id', id)
    .single()
  if (findError) throw dbError(findError)

  // Si es una transferencia se borran ambas patas para no descuadrar saldos.
  const { error } = current.transfer_id
    ? await supabase.from('transactions').delete().eq('transfer_id', current.transfer_id)
    : await supabase.from('transactions').delete().eq('id', id)

  if (error) throw dbError(error)
  res.status(204).end()
})

export default router
