import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'default' | 'master' | 'admin' | 'closer' | 'sdr' | 'success' | 'warning' | 'danger'
  children: ReactNode
  className?: string
}

const variantClasses = {
  default: 'bg-surface-3 text-text-muted',
  master: 'bg-primary/15 text-primary',
  admin: 'bg-blue-500/15 text-blue-500',
  closer: 'bg-success/15 text-success',
  sdr: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    master: 'Master',
    admin: 'Admin',
    closer: 'Closer',
    sdr: 'SDR',
  }

  return (
    <Badge variant={role as BadgeProps['variant']}>
      {labels[role] || role}
    </Badge>
  )
}
