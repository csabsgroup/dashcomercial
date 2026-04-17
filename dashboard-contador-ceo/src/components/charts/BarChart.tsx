import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { BarChartEntry } from '@/types/dashboard'

interface BarChartSeries {
  dataKey: string
  name: string
  color: string
}

interface BarChartProps {
  data: BarChartEntry[]
  series: BarChartSeries[]
  height?: number
  title?: string
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
}

export function BarChart({
  data,
  series,
  height = 300,
  title,
  layout = 'horizontal',
  stacked = false,
}: BarChartProps) {
  if (data.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout === 'vertical' ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {layout === 'vertical' ? (
            <>
              <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
            </>
          )}
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
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
