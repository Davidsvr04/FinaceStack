import type { ReactNode } from 'react'

export interface TooltipRow {
  label: string
  value: string
  /** Color de la serie: va en la marca corta, nunca en el texto. */
  color?: string
}

interface Props {
  title: string
  rows: TooltipRow[]
  /** Línea final separada (p. ej. el balance neto). */
  footer?: ReactNode
}

/**
 * Tooltip de las gráficas con el estilo de la app: el valor manda (negrita) y
 * la serie se identifica con una línea corta de su color.
 */
export function ChartTooltip({ title, rows, footer }: Props) {
  return (
    <div className="min-w-44 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold capitalize text-ink">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />}
            <span className="flex-1 text-ink-secondary">{row.label}</span>
            <span className="font-bold tabular-nums text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-2 border-t border-hairline pt-1.5">{footer}</div>}
    </div>
  )
}

/** Leyenda HTML para gráficas de barras: el marcador imita la marca (rectángulo). */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
