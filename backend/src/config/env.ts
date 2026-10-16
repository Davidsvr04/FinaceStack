import { resolveEnv } from '@supabase/server/core'

export const PORT = Number(process.env.PORT ?? 4000)
export const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

/**
 * Falla al arrancar si falta configuración de Supabase, en lugar de fallar
 * en la primera petición.
 */
export function assertSupabaseEnv(): void {
  const { data: env, error } = resolveEnv()
  if (error) throw error

  if (Object.keys(env.publishableKeys).length === 0) {
    throw new Error('Falta SUPABASE_PUBLISHABLE_KEY')
  }
  if (Object.keys(env.secretKeys).length === 0) {
    throw new Error('Falta SUPABASE_SECRET_KEY')
  }
  if (!env.jwks) {
    throw new Error('Falta SUPABASE_JWKS_URL: no se pueden verificar los JWT de usuario')
  }
}
