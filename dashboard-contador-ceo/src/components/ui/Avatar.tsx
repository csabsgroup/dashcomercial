import { User } from 'lucide-react'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
}

const iconSizes = { sm: 14, md: 18, lg: 22, xl: 28, '2xl': 40 }

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border ${className}`}
      />
    )
  }

  const initials = getInitials(name)

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-surface-3 border-2 border-border 
        flex items-center justify-center font-semibold text-text-muted ${className}`}
      aria-label={name}
    >
      {initials || <User size={iconSizes[size]} />}
    </div>
  )
}
