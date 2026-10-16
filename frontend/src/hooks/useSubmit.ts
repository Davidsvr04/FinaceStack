import { useCallback, useState } from 'react'

/** Estado de envío + error para acciones que llaman al API. */
export function useSubmit() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<void>) => {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { run, submitting, error, setError }
}
