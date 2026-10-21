import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMonth } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'
import { CHROME, SINGLE_HUE, TICK_STYLE } from './chartTheme'

interface Props {
  data: { month: string; value: number }[]
  /** Nombre de la serie en el tooltip (p. ej. "Nuevos usuarios"). */
  label: string
  format?: (value: number) => string
}

const plain = (value: number) => new Intl.NumberFormat('es-CO').format(value)

/**
 * Una sola serie por mes (barras de un tono). El mes en curso (el último) va
 * resaltado y con su valor; el resto se lee en el tooltip.
 */
export function MonthlyBarChart({ data, label, format = plain }: Props) {
  const lastMonth = data[data.length - 1]?.month

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis
          dataKey="month"
          tickFormatter={(month: string) => formatMonth(month, true)}
          tickLine={false}
          axisLine={{ stroke: CHROME.axis }}
          tick={TICK_STYLE}
        />
        <YAxis allowDecimals={false} tickFormatter={format} tickLine={false} axisLine={false} tick={TICK_STYLE} width={44} />
        <Tooltip
          cursor={{ fill: CHROME.grid, fillOpacity: 0.45 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as Props['data'][number] | undefined
            if (!active || !point) return null
            return (
              <ChartTooltip
                title={formatMonth(point.month)}
                rows={[{ label, value: format(point.value), color: SINGLE_HUE }]}
              />
            )
          }}
        />
        <Bar dataKey="value" fill={SINGLE_HUE} radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((d) => (
            <Cell key={d.month} fillOpacity={d.month === lastMonth ? 1 : 0.55} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            content={({ x, y, width, index }) => {
              const point = data[Number(index)]
              if (!point || point.month !== lastMonth) return null
              return (
                <text
                  x={Number(x) + Number(width) / 2}
                  y={Number(y) - 6}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={CHROME.ink}
                >
                  {format(point.value)}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
