export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-ink-secondary">
      <span className="size-5 animate-spin rounded-full border-2 border-hairline border-t-brand" />
      {label}
    </div>
  )
}
