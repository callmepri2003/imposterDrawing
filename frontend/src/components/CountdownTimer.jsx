import React, { useEffect, useState } from 'react'

export default function CountdownTimer({ timeoutAt, onExpire }) {
  const [secs, setSecs] = useState(null)

  useEffect(() => {
    if (!timeoutAt) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timeoutAt - Date.now()) / 1000))
      setSecs(remaining)
      if (remaining === 0) onExpire?.()
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [timeoutAt, onExpire])

  if (secs === null) return null
  const danger = secs <= 5
  return (
    <span
      className={`font-mono font-bold tabular-nums transition-colors ${
        danger ? 'text-red-400 animate-pulse' : 'text-gray-300'
      }`}
    >
      {secs}s
    </span>
  )
}
