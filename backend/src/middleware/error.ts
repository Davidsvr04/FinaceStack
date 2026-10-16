import type { ErrorRequestHandler, RequestHandler } from 'express'
import { HttpError } from '../lib/http.js'

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message })
    return
  }

  // JSON mal formado en el body
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
}
