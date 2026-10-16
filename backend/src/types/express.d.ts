import type { SupabaseClient } from '@supabase/supabase-js'

export type Role = 'user' | 'admin'

export interface RequestContext {
  userId: string
  email: string | null
  /** Cliente con el JWT del usuario: todas las consultas pasan por RLS. */
  supabase: SupabaseClient
  /** Solo se resuelve en rutas protegidas con requireAdmin. */
  role?: Role
}

declare global {
  namespace Express {
    interface Request {
      ctx?: RequestContext
    }
  }
}
