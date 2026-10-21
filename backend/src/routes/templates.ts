import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, money, parse, uuidParam } from '../lib/http.js'

// Plantillas de movimientos frecuentes (transporte, mercado...): precargan el
// formulario de nuevo movimiento; la fecha siempre es la del día en que se usan.
const router = Router()

const SELECT = '*, account:accounts(id, name, type, currency), category:categories(id, name, type)'

const templateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  // Opcional: gastos como el transporte varían y se escribe el monto al usarla.
  amount: money.nullable().optional(),
  account_id: z.uuid().nullable().optional(),
  category_id: z.uuid().nullable().optional(),
  description: z.string().trim().max(255).nullable().optional(),
  installments: z.coerce.number().int().min(1).max(48).optional(),
})

/** El nombre es único por usuario: lo traducimos a un mensaje claro. */
function templateError(error: Parameters<typeof dbError>[0]): HttpError {
  return error.code === '23505'
    ? new HttpError(409, 'Ya tienes una plantilla con ese nombre', error.code)
    : dbError(error)
}

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { data, error } = await supabase.from('movement_templates').select(SELECT).order('name')

  if (error) throw dbError(error)
  res.json(data)
})

router.post('/', async (req, res) => {
  const { supabase, userId } = getCtx(req)
  const input = parse(templateSchema, req.body)

  const { data, error } = await supabase
    .from('movement_templates')
    .insert({ ...input, user_id: userId })
    .select(SELECT)
    .single()

  if (error) throw templateError(error)
  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(templateSchema.partial(), req.body)

  const { data, error } = await supabase
    .from('movement_templates')
    .update(input)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw templateError(error)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)

  const { error, count } = await supabase
    .from('movement_templates')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) throw dbError(error)
  if (!count) throw new HttpError(404, 'Plantilla no encontrada')
  res.status(204).end()
})

export default router
