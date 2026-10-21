import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatPercent } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { ChartTooltip } from './ChartTooltip'
import { CHROME, SINGLE_HUE, TICK_STYLE } from './chartTheme'

const MAX_BARS = 6
const MAX_LABEL = 16

interface Props {
  data: { category: string; amount: number }[]
}

/** "Entretenimiento y ocio" -> "Entretenimiento…" para que quepa en el eje. */
const truncate = (text: string) => (text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text)

/**
 * Gastos por categoría como barras horizontales ordenadas (se comparan
 * longitudes, más fácil de leer que ángulos de una torta). La cola se agrupa
 * en "Otros" para no pasar de MAX_BARS. Cada barra lleva su monto y su parte
 * del total.
 */
export function ExpensesByCategoryChart({ data }: Props) {
  if (data.length === 0) {
    return <EmptyState text="Aún no hay gastos este mes" />
  }

  const total = data.reduce((sum, row) => sum + row.amount, 0)
  const grouped =
    data.length > MAX_BARS
      ? [
          ...data.slice(0, MAX_BARS - 1),
          {
            category: 'Otros',
            amount: data.slice(MAX_BARS - 1).reduce((sum, row) => sum + row.amount, 0),
          },
        ]
      : data
  const rows = grouped.map((row) => ({ ...row, share: total > 0 ? row.amount / total : 0 }))

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-secondary">
        Total del mes: <span className="font-bold tabular-nums text-ink">{formatCurrency(total)}</span>
      </p>
      <ResponsiveContainer width="100%" height={rows.length * 40 + 8}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="category"
            width={116}
            tickLine={false}
            axisLine={{ stroke: CHROME.axis }}
            tick={{ ...TICK_STYLE, fill: CHROME.inkSecondary }}
            tickFormatter={truncate}
          />
          <Tooltip
            cursor={{ fill: CHROME.grid, fillOpacity: 0.45 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof rows)[number] | undefined
              if (!active || !row) return null
              return (
                <ChartTooltip
                  title={row.category}
                  rows={[
                    { label: 'Gasto', value: formatCurrency(row.amount), color: SINGLE_HUE },
                    { label: 'Del total', value: formatPercent(row.share, 1) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="amount" fill={SINGLE_HUE} radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList
              dataKey="amount"
              position="right"
              content={({ x, y, width, height, index }) => {
                const row = rows[Number(index)]
                if (!row) return null
                return (
                  <text
                    x={Number(x) + Number(width) + 8}
                    y={Number(y) + Number(height) / 2}
                    dominantBaseline="central"
                    fontSize={12}
                  >
                    <tspan fill={CHROME.ink} fontWeight={600}>
                      {formatCompactCurrency(row.amount)}
                    </tspan>
                    <tspan fill={CHROME.tick}> · {formatPercent(row.share)}</tspan>
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
