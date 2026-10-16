import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { CHROME, SINGLE_HUE, TICK_STYLE } from './chartTheme'

const MAX_BARS = 6

interface Props {
  data: { category: string; amount: number }[]
}

/**
 * Gastos por categoría como barras horizontales ordenadas (se comparan
 * longitudes, más fácil de leer que ángulos de una torta). La cola se agrupa
 * en "Otros" para no pasar de MAX_BARS.
 */
export function ExpensesByCategoryChart({ data }: Props) {
  if (data.length === 0) {
    return <EmptyState text="Aún no hay gastos este mes" />
  }

  const rows =
    data.length > MAX_BARS
      ? [
          ...data.slice(0, MAX_BARS - 1),
          {
            category: 'Otros',
            amount: data.slice(MAX_BARS - 1).reduce((sum, row) => sum + row.amount, 0),
          },
        ]
      : data

  return (
    <ResponsiveContainer width="100%" height={rows.length * 40 + 16}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="category"
          width={120}
          tickLine={false}
          axisLine={{ stroke: CHROME.axis }}
          tick={{ ...TICK_STYLE, fill: CHROME.inkSecondary }}
        />
        <Tooltip
          cursor={{ fill: CHROME.grid, fillOpacity: 0.5 }}
          formatter={(value) => [formatCurrency(Number(value)), 'Gasto']}
          contentStyle={{ borderRadius: 8, borderColor: CHROME.grid }}
        />
        <Bar dataKey="amount" fill={SINGLE_HUE} radius={[0, 4, 4, 0]} barSize={20}>
          <LabelList
            dataKey="amount"
            position="right"
            formatter={(value) => formatCompactCurrency(Number(value))}
            style={{ fill: CHROME.inkSecondary, fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
