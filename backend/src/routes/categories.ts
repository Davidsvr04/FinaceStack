import { Router } from 'express'
import { z } from 'zod'
import { dbError, getCtx, HttpError, parse, uuidParam } from '../lib/http.js'

const router = Router()

const typeEnum = z.enum(['income', 'expense'])

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: typeEnum,
})

router.get('/', async (req, res) => {
  const { supabase } = getCtx(req)
  const { type } = parse(z.object({ type: typeEnum.optional() }), req.query)

  let query = supabase.from('categories').select('*').order('name')
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw dbError(error)
  res.json(data)
})

router.post('/', async (req, res) => {
  const { supabase, userId } = getCtx(req)
  const input = parse(createSchema, req.body)

  const { data, error } = await supabase
    .from('categories')
    .insert({ ...input, user_id: userId })
    .select()
    .single()

  if (error) throw dbError(error)
  res.status(201).json(data)
})

// Las categorías globales (user_id null) no pasan la política RLS de
// update/delete, así que aparecen como no encontradas.
router.patch('/:id', async (req, res) => {
  const { supabase } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const input = parse(createSchema.pick({ name: true }), req.body)

  const { data, error } = await supabase
    .from('categories')
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
    .from('categories')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) throw dbError(error)
  if (!count) throw new HttpError(404, 'Categoría no encontrada o no editable')
  res.status(204).end()
})

export default router
