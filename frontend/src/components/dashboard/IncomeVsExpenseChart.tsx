import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatMonth } from '../../lib/format'
import { CHROME, SERIES, TICK_STYLE } from './chartTheme'

interface Props {
  data: { month: string; income: number; expense: number }[]
}

const LABELS: Record<string, string> = { income: 'Ingresos', expense: 'Gastos' }

/** Barras agrupadas de ingresos vs gastos por mes, sobre un único eje. */
export function IncomeVsExpenseChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis
          dataKey="month"
          tickFormatter={(month: string) => formatMonth(month, true)}
          tickLine={false}
          axisLine={{ stroke: CHROME.axis }}
          tick={TICK_STYLE}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          tickLine={false}
          axisLine={false}
          tick={TICK_STYLE}
          width={72}
        />
        <Tooltip
          cursor={{ fill: CHROME.grid, fillOpacity: 0.5 }}
          labelFormatter={(month) => formatMonth(String(month))}
          formatter={(value, name) => [formatCurrency(Number(value)), LABELS[String(name)] ?? name]}
          contentStyle={{ borderRadius: 8, borderColor: CHROME.grid }}
        />
        <Legend
          formatter={(name: string) => <span style={{ color: CHROME.inkSecondary }}>{LABELS[name] ?? name}</span>}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
