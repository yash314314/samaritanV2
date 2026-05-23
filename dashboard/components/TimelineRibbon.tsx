"use client"

import useSWR from "swr"
import { getTimeline } from "@/lib/api"

const USER = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4"

export default function TimelineRibbon() {

  const date = new Date().toISOString().split("T")[0]

  const { data } = useSWR(
    "timeline",
    () => getTimeline(USER, date)
  )

  if (!data) return null

  return (
    <div className="bg-white p-6 shadow rounded">

      <h2 className="mb-4">
        Activity Timeline
      </h2>

      <div className="flex">

        {data.map((a:any, i:number) => (

          <div
            key={i}
            style={{ width: `${a.duration/60000}px` }}
            className="h-8 bg-blue-400 mr-1"
            title={`${a.appName} — ${a.intent}`}
          />

        ))}

      </div>

    </div>
  )
}