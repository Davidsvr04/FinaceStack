import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  text: string
  title?: string
  action?: ReactNode
}

export function EmptyState({ text, title = 'Sin información', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/50 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand/5 border border-brand/10 text-brand mb-3 shadow-xs">
        <Inbox className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
