import { createAdminClient } from '@supabase/server/core'
import { Router } from 'express'
import { z } from 'zod'
import { CURRENCIES, localToday } from '../lib/finance.js'
import { dbError, getCtx, HttpError, isoDate, parse, uuidParam } from '../lib/http.js'

const router = Router()

/**
 * Traduce la cuota de manejo del formulario (valor + fecha del próximo cobro)
 * a las columnas de la tabla. null en el valor = quitar la cuota.
 */
function handlingFeeColumns(input: { handling_fee_amount?: number | null; handling_fee_start?: string | null }) {
  const { handling_fee_amount: amount, handling_fee_start: start } = input
  if (amount === undefined) return {}
  if (amount === null) return { handling_fee_amount: null, handling_fee_day: null, handling_fee_start: null }
  if (!start) throw new HttpError(400, 'Indica la fecha en que te cobran la cuota de manejo')
  return { handling_fee_amount: amount, handling_fee_day: Number(start.slice(8, 10)), handling_fee_start: start }
}

/**
 * Registra en el momento los cobros de cuota de manejo que ya correspondan
 * (p. ej. si la fecha indicada es de hoy o pasada). El job diario hace el resto.
 * La función solo la ejecuta la secret key; la propiedad de la cuenta ya se
 * validó al guardarla con el cliente del usuario.
 */
async function generateHandlingFees(accountId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc('generate_handling_fees', {
    p_account_id: accountId,
    p_today: localToday(),
  })
  if (error) throw dbError(error)
  return Number(data ?? 0)
}

const creditCardFields = {
  credit_limit: z.coerce.number().nonnegative().optional(),
  cut_off_day: z.coerce.number().int().min(1).max(31).optional(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
  monthly_interest_rate: z.coerce.number().nonnegative().max(1).optional(),
  // Plan de la deuda inicial: ya facturado, cuánto se cobra en el próximo
  // extracto (null = todo) y en cuántos meses se cobra el resto.
  opening_billed_debt: z.coerce.number().nonnegative().multipleOf(0.01).optional(),
  opening_next_charge: z.coerce.number().nonnegative().multipleOf(0.01).nullable().optional(),
  opening_later_installments: z.coerce.number().int().min(1).max(48).optional(),
  // Cuota de manejo: valor y fecha del próximo cobro (de ahí sale el día del mes).
  handling_fee_amount: z.coerce.number().positive().multipleOf(0.01).nullable().optional(),
  handling_fee_start: isoDate.nullable().optional(),
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['bank', 'cash', 'credit_card']),
  // No se puede cambiar después. Las tarjetas solo pueden ser en pesos.
  currency: z.enum(CURRENCIES).default('COP'),
  // Saldo inicial. Para tarjetas: deuda actual como número positivo.
  initial_balance: z.coerce.number().default(0),
  ...creditCardFields,
})

const updateSchema = z
  .object({ name: z.string().trim().min(1).max(80), ...creditCardFields })
  .partial()

// Por defecto solo las cuentas en pesos: las de dólares se piden aparte.
const listSchema = z.object({ currency: z.enum([...CURRENCIES, 'all']).default('COP') })

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { currency } = parse(listSchema, req.query)

  let query = supabase.from('accounts').select('*').order('created_at', { ascending: true })
  if (currency !== 'all') query = query.eq('currency', currency)

  const { data, error } = await query
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
  if (isCard && input.currency !== 'COP') {
    throw new HttpError(400, 'Las tarjetas de crédito solo se manejan en pesos')
  }
  if ((input.opening_billed_debt ?? 0) + (input.opening_next_charge ?? 0) > Math.abs(initial_balance)) {
    throw new HttpError(400, 'Lo facturado más lo del próximo extracto no puede superar la deuda actual')
  }

  const { handling_fee_amount, handling_fee_start, ...fields } = input
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      ...fields,
      ...handlingFeeColumns({ handling_fee_amount, handling_fee_start }),
      user_id: userId,
      // En tarjetas la deuda se guarda en negativo (ver convención en el SQL).
      balance: isCard ? -Math.abs(initial_balance) : initial_balance,
    })
    .select()
    .single()

  if (error) throw dbError(error)
  const generated = data.handling_fee_amount ? await generateHandlingFees(data.id) : 0
  res.status(201).json({ ...data, handling_fees_generated: generated })
})

router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const { handling_fee_amount, handling_fee_start, ...fields } = parse(updateSchema, req.body)

  const { data, error } = await supabase
    .from('accounts')
    .update({ ...fields, ...handlingFeeColumns({ handling_fee_amount, handling_fee_start }) })
    .eq('id', id)
    .select()
    .single()

  if (error) throw dbError(error)
  const generated = data.handling_fee_amount ? await generateHandlingFees(data.id) : 0
  res.json({ ...data, handling_fees_generated: generated })
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
