import { useEffect, useState } from 'react'

/** Плавный count-up для hero-сумм (одна короткая анимация при появлении). */
export function useCountUp(target: number | null | undefined, durationMs = 900): number | null {
  const [value, setValue] = useState(0)
  const ready = target != null && Number.isFinite(Number(target))

  useEffect(() => {
    if (!ready) {
      setValue(0)
      return
    }
    const end = Number(target)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(end * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(end)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, ready])

  if (!ready) return null
  return value
}
