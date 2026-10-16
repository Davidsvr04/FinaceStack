import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, isoDate, money, parse, uuidParam } from '../lib/http.js'

const router = Router()

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target_amount: money,
  deadline: isoDate.nullable().optional(),
})

// Positivo = abono, negativo = retiro.
const contributionSchema = z.object({
  amount: z.coerce
    .number()
    .multipleOf(0.01)
    .refine((n) => n !== 0, 'El monto no puede ser cero'),
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
  const { amount } = parse(contributionSchema, req.body)

  const { data, error } = await supabase.rpc('add_savings_contribution', {
    p_goal_id: id,
    p_amount: amount,
  })

  if (error?.code === '23514') {
    throw new HttpError(400, 'No puedes retirar más de lo ahorrado en la meta', error.code)
  }
  if (error) throw dbError(error)
  res.json(data)
})

export default router
