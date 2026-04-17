import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import type { DonutChartEntry } from '@/types/dashboard'

interface DonutChartProps {
  data: DonutChartEntry[]
  height?: number
  title?: string
}

const defaultColors = ['#DF2531', '#f5c518', '#00c853', '#ff9800', '#f44336', '#c0c0c0', '#cd7f32', '#888888']

export function DonutChart({ data, height = 300, title }: DonutChartProps) {
  if (data.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={entry.fill || defaultColors[idx % defaultColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              color: 'var(--color-text)',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }}
            formatter={(value) => <span style={{ color: 'var(--color-text-muted)' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
