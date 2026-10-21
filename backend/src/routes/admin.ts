import type { SupabaseClient } from '@supabase/supabase-js'
import { Router } from 'express'
import { z } from 'zod'
import { createAdminClient } from '@supabase/server/core'
import { currentMonth, monthStart, round2 } from '../lib/finance.js'
import { dbError, fetchAll, getCtx, HttpError, parse, uuidParam } from '../lib/http.js'

// Todas las rutas de este router pasan antes por requireUser + requireAdmin.
// Usan el cliente admin (secret key), que salta RLS: no exponer datos
// individuales de transacciones, solo métricas agregadas y gestión de usuarios.
const router = Router()

const TREND_MONTHS = 6
const DAY_MS = 24 * 60 * 60 * 1000

/** Todos los usuarios de Auth (para la última fecha de acceso). */
async function listAllAuthUsers(admin: SupabaseClient) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new HttpError(500, error.message)
    users.push(...data.users)
    if (data.nextPage === null || data.users.length === 0) return users
  }
}

/** Movimientos como los ve el usuario: una transferencia (dos patas) cuenta una vez. */
function countMovements(rows: { transfer_id: string | null }[]): number {
  const transfers = new Set<string>()
  let single = 0
  for (const row of rows) {
    if (row.transfer_id) transfers.add(row.transfer_id)
    else single++
  }
  return single + transfers.size
}

router.get('/metrics', async (_req, res) => {
  const admin = createAdminClient()
  const month = currentMonth()
  const trendFrom = monthStart(month, -(TREND_MONTHS - 1))
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString()

  const [profiles, accounts, goals, templates, recentTx, totalTx, authUsers] = await Promise.all([
    fetchAll((from, to) =>
      admin.from('users_profiles').select('id, role, uses_usd, created_at').order('id').range(from, to),
    ),
    fetchAll((from, to) => admin.from('accounts').select('user_id, type, currency').order('id').range(from, to)),
    fetchAll((from, to) => admin.from('savings_goals').select('user_id').order('id').range(from, to)),
    fetchAll((from, to) => admin.from('movement_templates').select('user_id').order('id').range(from, to)),
    // Últimos meses: volumen en pesos (sin transferencias) y movimientos en cualquier moneda.
    fetchAll((from, to) =>
      admin
        .from('transactions')
        .select('type, amount, date, transfer_id, account:accounts!inner(currency)')
        .gte('date', trendFrom)
        .lt('date', monthStart(month, 1))
        .order('id')
        .range(from, to),
    ),
    admin.from('transactions').select('*', { count: 'exact', head: true }),
    listAllAuthUsers(admin),
  ])
  if (totalTx.error) throw dbError(totalTx.error)

  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => ({
    month: monthStart(month, i - (TREND_MONTHS - 1)).slice(0, 7),
    income: 0,
    expense: 0,
    movements: 0,
    new_users: 0,
  }))
  const byMonth = new Map(trend.map((bucket) => [bucket.month, bucket]))

  for (const profile of profiles) {
    const bucket = byMonth.get(String(profile.created_at).slice(0, 7))
    if (bucket) bucket.new_users++
  }

  const txByMonth = new Map<string, { transfer_id: string | null }[]>()
  for (const tx of recentTx) {
    const key = tx.date.slice(0, 7)
    txByMonth.set(key, [...(txByMonth.get(key) ?? []), tx])
    const bucket = byMonth.get(key)
    // Solo pesos, para no mezclar monedas en el total.
    const currency = (Array.isArray(tx.account) ? tx.account[0] : tx.account)?.currency
    if (!bucket || tx.transfer_id || currency !== 'COP') continue
    bucket[tx.type === 'income' ? 'income' : 'expense'] += Number(tx.amount)
  }
  for (const bucket of trend) bucket.movements = countMovements(txByMonth.get(bucket.month) ?? [])

  const accountsByType = { bank: 0, cash: 0, credit_card: 0, usd: 0 }
  for (const account of accounts) {
    if (account.currency === 'USD') accountsByType.usd++
    else accountsByType[account.type as 'bank' | 'cash' | 'credit_card']++
  }

  const usersWith = (rows: { user_id: string }[]) => new Set(rows.map((row) => row.user_id)).size
  const current = trend[trend.length - 1]!

  res.json({
    total_users: profiles.length,
    total_admins: profiles.filter((p) => p.role === 'admin').length,
    new_users_30d: profiles.filter((p) => p.created_at >= thirtyDaysAgo).length,
    active_users_30d: authUsers.filter((u) => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgo).length,
    total_accounts: accounts.length,
    accounts_by_type: accountsByType,
    total_transactions: totalTx.count ?? 0,
    movements_this_month: current.movements,
    month,
    platform_income: round2(current.income),
    platform_expense: round2(current.expense),
    trend: trend.map((b) => ({ ...b, income: round2(b.income), expense: round2(b.expense) })),
    // Cuántos usuarios usan cada función (para ver qué se adopta).
    adoption: {
      with_accounts: usersWith(accounts),
      with_cards: usersWith(accounts.filter((a) => a.type === 'credit_card')),
      with_goals: usersWith(goals),
      with_templates: usersWith(templates),
      with_usd: profiles.filter((p) => p.uses_usd).length,
    },
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
  // Solo conteos por usuario (cuentas y movimientos), nunca montos ni detalles.
  const [profilesResult, accounts, transactions] = await Promise.all([
    admin.from('users_profiles').select('id, role, full_name, uses_usd, created_at').in('id', ids),
    fetchAll((from, to) => admin.from('accounts').select('user_id').in('user_id', ids).order('id').range(from, to)),
    fetchAll((from, to) =>
      admin.from('transactions').select('user_id, transfer_id').in('user_id', ids).order('id').range(from, to),
    ),
  ])
  if (profilesResult.error) throw dbError(profilesResult.error)

  const profileById = new Map(profilesResult.data.map((p) => [p.id, p]))
  const countBy = <T extends { user_id: string }>(rows: T[], id: string) => rows.filter((r) => r.user_id === id)
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
      uses_usd: profileById.get(u.id)?.uses_usd ?? false,
      accounts_count: countBy(accounts, u.id).length,
      movements_count: countMovements(countBy(transactions, u.id)),
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
