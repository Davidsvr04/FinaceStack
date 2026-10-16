import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatMonth } from '../../lib/format'
import type { TrendPoint } from '../../types'
import { CHROME, SERIES, TICK_STYLE } from './chartTheme'

interface Props {
  data: TrendPoint[]
}

const LABELS: Record<string, string> = { income: 'Ingresos', expense: 'Gastos', saved: 'Ahorro' }

/** Barras agrupadas de ingresos, gastos y ahorro neto por mes, sobre un único eje. */
export function IncomeVsExpenseChart({ data }: Props) {
  const hasSavings = data.some((d) => d.saved !== 0)

  return (
    <div>
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
          <ReferenceLine y={0} stroke={CHROME.axis} />
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
          <Bar dataKey="income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="expense" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={24} />
          {hasSavings && <Bar dataKey="saved" fill={SERIES.saved} radius={[4, 4, 0, 0]} maxBarSize={24} />}
        </BarChart>
      </ResponsiveContainer>

      {/* Vista de tabla: alternativa accesible al color (el aqua tiene bajo contraste). */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink-secondary hover:text-ink">Ver como tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-right text-xs tabular-nums">
            <thead className="text-ink-secondary">
              <tr className="border-b border-hairline">
                <th className="py-1.5 pr-3 text-left font-medium">Mes</th>
                <th className="px-3 py-1.5 font-medium">Ingresos</th>
                <th className="px-3 py-1.5 font-medium">Gastos</th>
                <th className="py-1.5 pl-3 font-medium">Ahorro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.map((row) => (
                <tr key={row.month}>
                  <td className="py-1.5 pr-3 text-left capitalize">{formatMonth(row.month)}</td>
                  <td className="px-3 py-1.5">{formatCurrency(row.income)}</td>
                  <td className="px-3 py-1.5">{formatCurrency(row.expense)}</td>
                  <td className="py-1.5 pl-3">{formatCurrency(row.saved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
