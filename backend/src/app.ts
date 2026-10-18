import cors from 'cors'
import express from 'express'
import { assertSupabaseEnv, CORS_ORIGIN } from './config/env.js'
import { requireAdmin, requireUser } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/error.js'
import accounts from './routes/accounts.js'
import admin from './routes/admin.js'
import categories from './routes/categories.js'
import creditCards from './routes/credit-cards.js'
import dashboard from './routes/dashboard.js'
import savings from './routes/savings.js'
import templates from './routes/templates.js'
import transactions from './routes/transactions.js'

// Falla al cargar si falta configuración de Supabase, en lugar de en la primera petición.
assertSupabaseEnv()

const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// A partir de aquí todo requiere un usuario autenticado.
const api = express.Router()
api.use(requireUser)
api.use('/accounts', accounts)
api.use('/categories', categories)
api.use('/transactions', transactions)
api.use('/templates', templates)
api.use('/savings-goals', savings)
api.use('/credit-cards', creditCards)
api.use('/dashboard', dashboard)
api.use('/admin', requireAdmin, admin)

app.use('/api', api)
app.use(notFound)
app.use(errorHandler)

// Vercel usa src/app.ts como entrada y espera la app como export default.
export default app
