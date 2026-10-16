import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, isoDate, money, parse, uuidParam } from '../lib/http.js'

const router = Router()

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target_amount: money,
  deadline: isoDate.nullable().optional(),
  // Ahorro que ya existía antes de la app: suma a la meta sin salir de una cuenta.
  initial_amount: z.coerce.number().nonnegative().multipleOf(0.01).optional(),
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

  // Bajar el ahorro previo puede dejar la meta en negativo si ya hubo retiros.
  if (error?.code === '23514') {
    throw new HttpError(400, 'El ahorro previo no puede quedar por debajo de lo que ya retiraste de la meta')
  }
  if (error) throw dbError(error)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)

  // Lo abonado desde cuentas hay que devolverlo antes de borrar la meta, o se
  // perdería. El ahorro previo no salió de ninguna cuenta y puede descartarse.
  const { data: goal, error: findError } = await supabase
    .from('savings_goals')
    .select('current_amount, initial_amount')
    .eq('id', id)
    .single()
  if (findError) throw dbError(findError)
  const fromAccounts = Number(goal.current_amount) - Number(goal.initial_amount)
  if (fromAccounts > 0) {
    throw new HttpError(
      409,
      'La meta tiene dinero abonado desde tus cuentas; retíralo a una cuenta antes de eliminarla',
    )
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
