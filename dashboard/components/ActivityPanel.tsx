
"use client"

import { useState } from "react"

export default function ActivityPanel() {

  const [tab, setTab] = useState("apps")

  return (
    <div className="bg-zinc-900 rounded-xl p-4 h-full flex flex-col">

      <div className="flex gap-3 mb-4">
        <button onClick={() => setTab("apps")}>Apps</button>
        <button onClick={() => setTab("windows")}>Windows</button>
      </div>

      <div className="space-y-3 overflow-y-auto">

        {tab === "apps" && (
          <>
            <ActivityItem name="Cursor" duration="1h 42m"/>
            <ActivityItem name="Chrome" duration="52m"/>
            <ActivityItem name="Terminal" duration="21m"/>
          </>
        )}

        {tab === "windows" && (
          <>
            <ActivityItem name="parser.py - Cursor" duration="42m"/>
            <ActivityItem name="YouTube - Chrome" duration="18m"/>
            <ActivityItem name="StackOverflow - Chrome" duration="15m"/>
          </>
        )}

      </div>

    </div>
  )
}

function ActivityItem({ name, duration }: any) {
  return (
    <div className="flex justify-between text-sm">
      <span className="truncate">{name}</span>
      <span className="text-zinc-400">{duration}</span>
    </div>
  )
}