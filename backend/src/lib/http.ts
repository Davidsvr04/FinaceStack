import type { Request } from 'express'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import type { RequestContext } from '../types/express.js'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'HTTP_ERROR',
  ) {
    super(message)
  }
}

export function getCtx(req: Request): RequestContext {
  if (!req.ctx) throw new HttpError(401, 'No autenticado', 'UNAUTHENTICATED')
  return req.ctx
}

/** Valida body/query con zod y lanza 400 con el detalle si no cumple. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new HttpError(400, z.prettifyError(result.error), 'VALIDATION_ERROR')
  }
  return result.data
}

const POSTGRES_STATUS: Record<string, number> = {
  PGRST116: 404, // .single() sin filas
  P0002: 404, // no_data_found (lanzado en funciones RPC)
  '23505': 409, // unique_violation
  '23503': 400, // foreign_key_violation
  '23514': 400, // check_violation
  '22P02': 400, // invalid_text_representation (p. ej. uuid mal formado)
  '42501': 403, // insufficient_privilege / RLS
}

/** Convierte un error de PostgREST en HttpError con el status adecuado. */
export function dbError(error: PostgrestError): HttpError {
  const status = POSTGRES_STATUS[error.code] ?? 500
  const message = status === 404 ? 'Recurso no encontrado' : error.message
  return new HttpError(status, message, error.code)
}

const FETCH_PAGE = 1000

/**
 * Lee todas las filas de una consulta por páginas: PostgREST corta en 1000
 * filas sin avisar. `page` arma la consulta (con un orden estable) para un rango.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += FETCH_PAGE) {
    const { data, error } = await page(from, from + FETCH_PAGE - 1)
    if (error) throw dbError(error)
    rows.push(...(data ?? []))
    if (!data || data.length < FETCH_PAGE) return rows
  }
}

export const uuidParam = z.object({ id: z.uuid() })
export const isoDate = z.iso.date()
export const money = z.coerce.number().positive().multipleOf(0.01)
