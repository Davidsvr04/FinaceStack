import { Router } from 'express'
import { z } from 'zod'
import { createAdminClient } from '@supabase/server/core'
import { currentMonth, monthStart, round2 } from '../lib/finance.js'
import { dbError, getCtx, HttpError, parse, uuidParam } from '../lib/http.js'

// Todas las rutas de este router pasan antes por requireUser + requireAdmin.
// Usan el cliente admin (secret key), que salta RLS: no exponer datos
// individuales de transacciones, solo métricas agregadas y gestión de usuarios.
const router = Router()

router.get('/metrics', async (_req, res) => {
  const admin = createAdminClient()
  const month = currentMonth()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [users, admins, newUsers, accounts, transactions, monthTx] = await Promise.all([
    admin.from('users_profiles').select('*', { count: 'exact', head: true }),
    admin.from('users_profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    admin
      .from('users_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),
    admin.from('accounts').select('*', { count: 'exact', head: true }),
    admin.from('transactions').select('*', { count: 'exact', head: true }),
    // Para volúmenes grandes conviene mover esta suma a una función SQL.
    admin
      .from('transactions')
      .select('type, amount')
      .gte('date', monthStart(month))
      .lt('date', monthStart(month, 1))
      .is('transfer_id', null),
  ])

  for (const result of [users, admins, newUsers, accounts, transactions, monthTx]) {
    if (result.error) throw dbError(result.error)
  }

  let income = 0
  let expense = 0
  for (const tx of monthTx.data ?? []) {
    if (tx.type === 'income') income += Number(tx.amount)
    else expense += Number(tx.amount)
  }

  res.json({
    total_users: users.count ?? 0,
    total_admins: admins.count ?? 0,
    new_users_30d: newUsers.count ?? 0,
    total_accounts: accounts.count ?? 0,
    total_transactions: transactions.count ?? 0,
    month,
    platform_income: round2(income),
    platform_expense: round2(expense),
  })
})

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
})

router.get('/users', async (req, res) => {
  const { page, per_page } = parse(listUsersSchema, req.query)
  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page,
    perPage: per_page,
  })
  if (authError) throw new HttpError(500, authError.message)

  const ids = authData.users.map((u) => u.id)
  const { data: profiles, error } = await admin
    .from('users_profiles')
    .select('id, role, full_name, created_at')
    .in('id', ids)
  if (error) throw dbError(error)

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  res.json({
    page,
    per_page,
    total: authData.total,
    has_more: authData.nextPage !== null,
    users: authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      role: profileById.get(u.id)?.role ?? 'user',
      full_name: profileById.get(u.id)?.full_name ?? null,
      created_at: u.created_at,
    })),
  })
})

router.patch('/users/:id/role', async (req, res) => {
  const { userId } = getCtx(req)
  const { id } = parse(uuidParam, req.params)
  const { role } = parse(z.object({ role: z.enum(['user', 'admin']) }), req.body)

  if (id === userId && role !== 'admin') {
    throw new HttpError(400, 'No puedes quitarte tu propio rol de administrador')
  }

  const { data, error } = await createAdminClient()
    .from('users_profiles')
    .update({ role })
    .eq('id', id)
    .select('id, role, full_name')
    .single()

  if (error) throw dbError(error)
  res.json(data)
})

router.delete('/users/:id', async (req, res) => {
  const { userId } = getCtx(req)
  const { id } = parse(uuidParam, req.params)

  if (id === userId) throw new HttpError(400, 'No puedes eliminar tu propia cuenta desde aquí')

  // Borra el usuario de Auth; el perfil y sus datos caen en cascada.
  const { error } = await createAdminClient().auth.admin.deleteUser(id)
  if (error) throw new HttpError(error.status ?? 500, error.message)
  res.status(204).end()
})

export default router
