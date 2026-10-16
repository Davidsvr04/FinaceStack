import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, isoDate, money, parse, uuidParam } from '../lib/http.js'

const router = Router()

const SELECT = '*, account:accounts(id, name, type), category:categories(id, name, type)'

const createSchema = z.object({
  account_id: z.uuid(),
  category_id: z.uuid().nullable().optional(),
  type: z.enum(['income', 'expense']),
  amount: money,
  date: isoDate.optional(),
  description: z.string().trim().max(255).nullable().optional(),
})

const listSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  type: z.enum(['income', 'expense']).optional(),
  account_id: z.uuid().optional(),
  category_id: z.uuid().optional(),
  include_transfers: z.stringbool().default(false),
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
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.account_id) query = query.eq('account_id', filters.account_id)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (!filters.include_transfers) query = query.is('transfer_id', null)

  const { data, error, count } = await query
  if (error) throw dbError(error)
  res.json({ data, total: count ?? 0 })
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
