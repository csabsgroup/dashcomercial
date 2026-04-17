import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { ChartDataPoint } from '@/types/dashboard'

interface LineChartSeries {
  dataKey: string
  name: string
  color: string
  dashed?: boolean
}

interface LineChartProps {
  data: ChartDataPoint[]
  series: LineChartSeries[]
  height?: number
  title?: string
}

export function LineChart({ data, series, height = 300, title }: LineChartProps) {
  if (data.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              color: 'var(--color-text)',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 5' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
