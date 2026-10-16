import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, isoDate, money, parse, uuidParam } from '../lib/http.js'

const router = Router()

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target_amount: money,
  deadline: isoDate.nullable().optional(),
})

// Positivo = abono (sale de account_id), negativo = retiro (entra a account_id).
const contributionSchema = z.object({
  account_id: z.uuid(),
  amount: z.coerce
    .number()
    .multipleOf(0.01)
    .refine((n) => n !== 0, 'El monto no puede ser cero'),
  date: isoDate.optional(),
})

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })

  if (error) throw dbError(error)
  res.json(
    data.map((goal) => ({
      ...goal,
      progress: Math.min(1, Number(goal.current_amount) / Number(goal.target_amount)),
    })),
  )
})

router.post('/', async (req, res) => {
  const { supabase, userId } = getCtx(req)
  const input = parse(createSchema, req.body)

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({ ...input, user_id: userId })
    .select()
    .single()

  if (error) throw dbError(error)
  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(createSchema.partial(), req.body)

  const { data, error } = await supabase
    .from('savings_goals')
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

  // El dinero de la meta salió de una cuenta: hay que devolverlo antes de borrarla.
  const { data: goal, error: findError } = await supabase
    .from('savings_goals')
    .select('current_amount')
    .eq('id', id)
    .single()
  if (findError) throw dbError(findError)
  if (Number(goal.current_amount) > 0) {
    throw new HttpError(409, 'La meta aún tiene dinero ahorrado; retíralo a una cuenta antes de eliminarla')
  }

  const { error, count } = await supabase
    .from('savings_goals')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) throw dbError(error)
  if (!count) throw new HttpError(404, 'Meta no encontrada')
  res.status(204).end()
})

router.post('/:id/contributions', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(contributionSchema, req.body)

  // Crea el movimiento en la cuenta; los triggers ajustan el saldo de la
  // cuenta y el acumulado de la meta.
  const { data: transactionId, error } = await supabase.rpc('add_savings_contribution', {
    p_goal_id: id,
    p_account_id: input.account_id,
    p_amount: input.amount,
    ...(input.date && { p_date: input.date }),
  })
  if (error) throw dbError(error)

  const { data: goal, error: goalError } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', id)
    .single()
  if (goalError) throw dbError(goalError)

  res.status(201).json({ transaction_id: transactionId, goal })
})

export default router
