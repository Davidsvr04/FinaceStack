export function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-48 place-items-center rounded-lg border border-dashed border-hairline text-sm text-ink-muted">
      {text}
    </div>
  )
}
