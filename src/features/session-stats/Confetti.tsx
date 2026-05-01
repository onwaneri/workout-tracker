import { useEffect, useRef } from 'react'

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcf7f', '#4ecdc4', '#a78bfa', '#f87171', '#60a5fa']

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  color: string
  size: number
}

export function Confetti({ duration = 2800, count = 140 }: { duration?: number; count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)

    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 160,
        y: h * 0.32,
        vx: (Math.random() - 0.5) * 9,
        vy: -(Math.random() * 9 + 6),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 7 + 4,
      })
    }

    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.vy += 0.22
        p.vx *= 0.995
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration, count])

  return <canvas ref={canvasRef} aria-hidden className="fixed inset-0 z-50 pointer-events-none" />
}
