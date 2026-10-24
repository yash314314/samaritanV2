"use client"

import { useSyncExternalStore } from "react"

const formatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000)
  return () => clearInterval(timer)
}

// Whole seconds, so consecutive reads within a second are equal.
const getSnapshot = () => Math.floor(Date.now() / 1000)

// No clock on the server: a static export would otherwise bake in the build
// time and mismatch on hydration.
const getServerSnapshot = () => null

export default function LiveClock({ className = "" }: { className?: string }) {

  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const time = seconds === null ? null : new Date(seconds * 1000)

  return (
    <time
      className={`sam-numeral block ${className}`}
      dateTime={time?.toISOString()}
    >
      {time ? formatter.format(time) : "--:--:--"}
    </time>
  )
}
