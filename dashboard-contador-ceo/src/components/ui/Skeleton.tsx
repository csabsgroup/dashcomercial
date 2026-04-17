interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circle' | 'rect'
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', variant = 'rect', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-surface-3 rounded'
  const variantClasses = {
    text: 'h-4 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-busy="true"
    />
  )
}

export function KPICardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function RankingCardSkeleton() {
  return (
    <div className="flex items-center gap-4 bg-surface rounded-2xl border border-border p-4">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  )
}
