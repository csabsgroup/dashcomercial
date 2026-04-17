import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}

export function AnimatedNumber({ value, duration = 1500, format, className = '' }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const from = prevValueRef.current
    const to = value
    prevValueRef.current = value

    if (from === to) return

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo for dramatic deceleration
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = from + (to - from) * eased

      setDisplayValue(current)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animRef.current)
  }, [value, duration])

  const formatted = format ? format(displayValue) : Math.round(displayValue).toLocaleString('pt-BR')

  return <span className={className}>{formatted}</span>
}
