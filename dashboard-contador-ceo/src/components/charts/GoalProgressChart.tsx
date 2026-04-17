import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface GoalProgressEntry {
  name: string
  realized: number
  target: number
}

interface GoalProgressChartProps {
  data: GoalProgressEntry[]
  height?: number
  title?: string
}

export function GoalProgressChart({ data, height = 300, title }: GoalProgressChartProps) {
  if (data.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
          <Bar
            dataKey="realized"
            name="Realizado"
            fill="#00c853"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Line
            type="monotone"
            dataKey="target"
            name="Meta"
            stroke="#f5c518"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: '#f5c518' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
