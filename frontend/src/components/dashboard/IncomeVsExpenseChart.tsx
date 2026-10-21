import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatMonth } from '../../lib/format'
import { ChartLegend, ChartTooltip } from './ChartTooltip'
import { CHROME, SERIES, TICK_STYLE } from './chartTheme'

interface Point {
  month: string
  income: number
  expense: number
  /** Ahorro neto; la serie solo aparece si algún mes es distinto de 0. */
  saved?: number
}

interface Props {
  data: Point[]
  /** Mes en foco ("YYYY-MM"): los demás se atenúan. */
  highlightMonth?: string
}

const SERIES_META = [
  { key: 'income', label: 'Ingresos', color: SERIES.income },
  { key: 'expense', label: 'Gastos', color: SERIES.expense },
  { key: 'saved', label: 'Ahorro', color: SERIES.saved },
] as const

/** Barras agrupadas de ingresos, gastos y ahorro neto por mes, sobre un único eje. */
export function IncomeVsExpenseChart({ data, highlightMonth }: Props) {
  const hasSavings = data.some((d) => (d.saved ?? 0) !== 0)
  const series = SERIES_META.filter((s) => s.key !== 'saved' || hasSavings)
  const dimmed = (month: string) => highlightMonth !== undefined && month !== highlightMonth

  return (
    <div className="space-y-3">
      <ChartLegend items={[...series]} />

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
            width={68}
          />
          <ReferenceLine y={0} stroke={CHROME.axis} />
          <Tooltip
            cursor={{ fill: CHROME.grid, fillOpacity: 0.45 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as Point | undefined
              if (!active || !point) return null
              const net = point.income - point.expense
              return (
                <ChartTooltip
                  title={formatMonth(point.month)}
                  rows={series.map((s) => ({
                    label: s.label,
                    value: formatCurrency(point[s.key] ?? 0),
                    color: s.color,
                  }))}
                  footer={
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-secondary">Balance neto</span>
                      <span className={`font-bold tabular-nums ${net >= 0 ? 'text-status-good' : 'text-status-critical'}`}>
                        {net > 0 && '+'}
                        {formatCurrency(net)}
                      </span>
                    </div>
                  }
                />
              )
            }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={d.month} fillOpacity={dimmed(d.month) ? 0.4 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Vista de tabla: alternativa accesible al color (el aqua tiene bajo contraste). */}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink-secondary hover:text-ink">Ver como tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-right text-xs tabular-nums">
            <thead className="text-ink-secondary">
              <tr className="border-b border-hairline">
                <th className="py-1.5 pr-3 text-left font-medium">Mes</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 font-medium">
                    {s.label}
                  </th>
                ))}
                <th className="py-1.5 pl-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.map((row) => (
                <tr key={row.month} className={dimmed(row.month) ? '' : 'font-semibold'}>
                  <td className="py-1.5 pr-3 text-left capitalize">{formatMonth(row.month)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5">
                      {formatCurrency(row[s.key] ?? 0)}
                    </td>
                  ))}
                  <td className="py-1.5 pl-3">{formatCurrency(row.income - row.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
