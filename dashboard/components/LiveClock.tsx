"use client"

import { useEffect, useState } from "react"

export default function LiveClock() {

  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatted = time.toLocaleTimeString()

  return (
    <div className="text-3xl font-mono tracking-wide">
      {formatted}
    </div>
  )
}