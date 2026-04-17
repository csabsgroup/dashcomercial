interface ProgressBarProps {
  value: number
  max?: number
  color?: 'auto' | 'gold' | 'success' | 'warning' | 'danger' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

function getAutoColor(percent: number): string {
  if (percent >= 90) return 'bg-success'
  if (percent >= 60) return 'bg-warning'
  return 'bg-danger'
}

const colorClasses = {
  gold: 'bg-gold',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export function ProgressBar({
  value,
  max = 100,
  color = 'auto',
  size = 'md',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor = color === 'auto' ? getAutoColor(percent) : colorClasses[color]

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{percent.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full ${sizeClasses[size]} bg-surface-3 rounded-full overflow-hidden`}>
        <div
          className={`${sizeClasses[size]} ${barColor} rounded-full transition-all duration-700 ease-out relative overflow-hidden`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          {percent >= 90 && <div className="absolute inset-0 progress-shimmer" />}
        </div>
      </div>
    </div>
  )
}
