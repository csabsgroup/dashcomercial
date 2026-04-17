import { useEffect, useRef, useCallback } from 'react'

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  rotation: number
  rotationSpeed: number
  color: string
  life: number
  maxLife: number
}

interface ConfettiCanvasProps {
  active: boolean
  onComplete?: () => void
}

const CONFETTI_COLORS = [
  '#DF2531', '#c91f2a', '#ff4757', // brand reds
  '#f5c518', '#ffd700',             // gold
  '#ffffff', '#e0e0e0',             // white/silver
  '#00c853',                        // success green
]

export function ConfettiCanvas({ active, onComplete }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const piecesRef = useRef<ConfettiPiece[]>([])
  const animRef = useRef<number>(0)
  const hasTriggered = useRef(false)

  const createPiece = useCallback((canvasWidth: number): ConfettiPiece => {
    return {
      x: canvasWidth * 0.5 + (Math.random() - 0.5) * canvasWidth * 0.4,
      y: -10,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 3 + 2,
      width: 4 + Math.random() * 6,
      height: 8 + Math.random() * 10,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 1,
      maxLife: 120 + Math.random() * 80,
    }
  }, [])

  useEffect(() => {
    if (!active || hasTriggered.current) return
    hasTriggered.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Create initial burst
    for (let i = 0; i < 80; i++) {
      const piece = createPiece(canvas.width)
      piece.vy = -(Math.random() * 12 + 4)
      piece.vx = (Math.random() - 0.5) * 16
      piece.y = canvas.height * 0.4
      piecesRef.current.push(piece)
    }

    let spawnCount = 0
    const maxSpawns = 60

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn additional pieces in the first frames
      if (spawnCount < maxSpawns) {
        for (let i = 0; i < 3; i++) {
          piecesRef.current.push(createPiece(canvas.width))
        }
        spawnCount++
      }

      piecesRef.current = piecesRef.current.filter(p => {
        p.x += p.vx
        p.vy += 0.15 // gravity
        p.y += p.vy
        p.vx *= 0.99 // air resistance
        p.rotation += p.rotationSpeed
        p.life -= 1 / p.maxLife

        if (p.life <= 0 || p.y > canvas.height + 20) return false

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = Math.min(p.life * 1.5, 1)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        ctx.restore()

        return true
      })

      ctx.globalAlpha = 1

      if (piecesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        onComplete?.()
      }
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [active, createPiece, onComplete])

  // Reset trigger when deactivated
  useEffect(() => {
    if (!active) {
      hasTriggered.current = false
      piecesRef.current = []
    }
  }, [active])

  if (!active && piecesRef.current.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  )
}
