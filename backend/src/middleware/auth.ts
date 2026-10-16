import type { RequestHandler } from 'express'
import { createContextClient, verifyCredentials } from '@supabase/server/core'
import { dbError, getCtx, HttpError } from '../lib/http.js'

function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

/**
 * Verifica el JWT de Supabase Auth (contra el JWKS del proyecto) y adjunta
 * a la petición un cliente de Supabase con la identidad del usuario, de modo
 * que todas las consultas respetan RLS.
 */
export const requireUser: RequestHandler = async (req, res, next) => {
  const { data: auth, error } = await verifyCredentials(
    { token: bearerToken(req.get('authorization')), apikey: null },
    { auth: 'user' },
  )

  if (error) {
    res.status(error.status).json({ error: error.code, message: error.message })
    return
  }

  req.ctx = {
    userId: auth.userClaims!.id,
    email: auth.userClaims!.email ?? null,
    supabase: createContextClient({
      auth: { token: auth.token, keyName: auth.keyName },
    }),
  }
  next()
}

/** Debe ir después de requireUser. Lee el rol desde users_profiles. */
export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const ctx = getCtx(req)
  const { data, error } = await ctx.supabase
    .from('users_profiles')
    .select('role')
    .eq('id', ctx.userId)
    .single()

  if (error) throw dbError(error)
  if (data.role !== 'admin') {
    throw new HttpError(403, 'Se requiere rol de administrador', 'FORBIDDEN')
  }

  ctx.role = 'admin'
  next()
}
