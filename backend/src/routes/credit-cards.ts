import { Router } from 'express'
import { z } from 'zod'
import { nextDayOfMonth, round2, simulatePayoff } from '../lib/finance.js'
import { dbError, getCtx, isoDate, money, parse, uuidParam } from '../lib/http.js'

// Las tarjetas se crean/editan/borran por /api/accounts con type=credit_card.
// Aquí viven las vistas y operaciones específicas de tarjetas.
const router = Router()

const paymentSchema = z.object({
  from_account_id: z.uuid(),
  amount: money,
  date: isoDate.optional(),
  description: z.string().trim().max(255).optional(),
})

const simulateSchema = z.object({
  monthly_payment: money,
  // Si se omite, se usa la tasa registrada en la tarjeta.
  monthly_interest_rate: z.coerce.number().nonnegative().max(1).optional(),
})

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'credit_card')
    .order('created_at')

  if (error) throw dbError(error)

  res.json(
    data.map((card) => {
      const debt = Math.max(0, -Number(card.balance))
      const limit = card.credit_limit === null ? null : Number(card.credit_limit)
      return {
        ...card,
        debt: round2(debt),
        available_credit: limit === null ? null : round2(Math.max(0, limit - debt)),
        utilization: limit ? round2(debt / limit) : null,
        next_cut_off_date: card.cut_off_day ? nextDayOfMonth(card.cut_off_day) : null,
        next_payment_date: card.payment_due_day ? nextDayOfMonth(card.payment_due_day) : null,
      }
    }),
  )
})

/** Registra un pago a la tarjeta desde una cuenta bancaria o de efectivo. */
router.post('/:id/payments', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(paymentSchema, req.body)

  const { data: transferId, error } = await supabase.rpc('pay_credit_card', {
    p_card_id: id,
    p_from_account_id: input.from_account_id,
    p_amount: input.amount,
    ...(input.date && { p_date: input.date }),
    ...(input.description && { p_description: input.description }),
  })

  if (error) throw dbError(error)
  res.status(201).json({ transfer_id: transferId })
})

/** Simula cuántos meses toma saldar la deuda con una cuota fija. */
router.post('/:id/simulate', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(simulateSchema, req.body)

  const { data: card, error } = await supabase
    .from('accounts')
    .select('balance, monthly_interest_rate')
    .eq('id', id)
    .eq('type', 'credit_card')
    .single()

  if (error) throw dbError(error)

  const debt = Math.max(0, -Number(card.balance))
  const rate = input.monthly_interest_rate ?? Number(card.monthly_interest_rate ?? 0)

  res.json({
    debt: round2(debt),
    monthly_interest_rate: rate,
    monthly_payment: input.monthly_payment,
    ...simulatePayoff(debt, rate, input.monthly_payment),
  })
})

export default router
