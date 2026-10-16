import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** fetch al backend con el JWT de la sesión actual en Authorization. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.message ?? response.statusText)
  }

  return response.status === 204 ? (undefined as T) : response.json()
}

/** POST / PATCH / DELETE con cuerpo JSON. */
export function send<T = unknown>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
  return api<T>(path, {
    method,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
}
