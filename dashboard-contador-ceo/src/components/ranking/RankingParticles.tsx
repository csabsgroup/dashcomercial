import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

interface RankingParticlesProps {
  active: boolean
  burst?: boolean
  color?: string
}

const GOLD_COLORS = ['#f5c518', '#ffd700', '#ffed4a', '#ffe082', '#fff176']

function resolveColor(c: string): string {
  if (c.startsWith('var(')) {
    const varName = c.slice(4, -1)
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || c
  }
  return c
}

export function RankingParticles({ active, burst = false, color }: RankingParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)

  const createParticle = useCallback((isBurst: boolean): Particle => {
    const canvas = canvasRef.current
    if (!canvas) return {} as Particle
    const baseColor = color ? resolveColor(color) : GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]

    if (isBurst) {
      return {
        x: canvas.width / 2 + (Math.random() - 0.5) * 40,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        life: 1,
        maxLife: 40 + Math.random() * 30,
        size: 2 + Math.random() * 3,
        color: baseColor,
      }
    }

    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 5,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.3 - Math.random() * 0.7,
      life: 1,
      maxLife: 80 + Math.random() * 60,
      size: 1 + Math.random() * 2,
      color: baseColor,
    }
  }, [color])

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.parentElement?.getBoundingClientRect()
    if (rect) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    if (burst) {
      // Create burst of particles
      for (let i = 0; i < 30; i++) {
        particlesRef.current.push(createParticle(true))
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Add ambient particles if not burst mode
      if (!burst && particlesRef.current.length < 15 && Math.random() > 0.92) {
        particlesRef.current.push(createParticle(false))
      }

      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx
        p.y += p.vy
        if (burst) p.vy += 0.1 // gravity for burst
        p.life -= 1 / p.maxLife

        if (p.life <= 0) return false

        ctx.globalAlpha = p.life * 0.7
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        // Glow effect
        ctx.globalAlpha = p.life * 0.3
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
        ctx.fill()

        return true
      })

      ctx.globalAlpha = 1

      if (active || particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [active, burst, createParticle])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
