import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import type { FunnelStep } from '@/types/dashboard'

interface FunnelChartProps {
  data: FunnelStep[]
  height?: number
}

const defaultColors = ['#DF2531', '#00c853', '#f5c518', '#ff9800', '#f44336', '#c0c0c0']

export function FunnelChart({ data, height = 300 }: FunnelChartProps) {
  if (data.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
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
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={36}>
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={entry.fill || defaultColors[idx % defaultColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
