import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env')
}

// Solo para Auth y lecturas protegidas por RLS. La lógica de negocio va por el API.
export const supabase = createClient(url, publishableKey)
