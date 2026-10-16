import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, parse, uuidParam } from '../lib/http.js'

const router = Router()

const creditCardFields = {
  credit_limit: z.coerce.number().nonnegative().optional(),
  cut_off_day: z.coerce.number().int().min(1).max(31).optional(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
  monthly_interest_rate: z.coerce.number().nonnegative().max(1).optional(),
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['bank', 'cash', 'credit_card']),
  // Saldo inicial. Para tarjetas: deuda actual como número positivo.
  initial_balance: z.coerce.number().default(0),
  ...creditCardFields,
})

const updateSchema = z
  .object({ name: z.string().trim().min(1).max(80), ...creditCardFields })
  .partial()

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw dbError(error)
  res.json(data)
})

router.post('/', async (req, res) => {
  const { supabase, userId } = getCtx(req)
  const { initial_balance, ...input } = parse(createSchema, req.body)

  const isCard = input.type === 'credit_card'
  const hasCardFields = Object.keys(creditCardFields).some(
    (key) => input[key as keyof typeof input] !== undefined,
  )
  if (!isCard && hasCardFields) {
    throw new HttpError(400, 'Los campos de tarjeta solo aplican a cuentas tipo credit_card')
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      ...input,
      user_id: userId,
      // En tarjetas la deuda se guarda en negativo (ver convención en el SQL).
      balance: isCard ? -Math.abs(initial_balance) : initial_balance,
    })
    .select()
    .single()

  if (error) throw dbError(error)
  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(updateSchema, req.body)

  const { data, error } = await supabase
    .from('accounts')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw dbError(error)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)

  const { error, count } = await supabase
    .from('accounts')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) throw dbError(error)
  if (!count) throw new HttpError(404, 'Cuenta no encontrada')
  res.status(204).end()
})

export default router
