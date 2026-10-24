"use client";

interface RibbonItem {
  duration: number;
  appName: string;
  intent?: string;
}

export default function TimelineRibbon({ data }: { data?: RibbonItem[] }) {

  if (!data) return null

  return (
    <div className="samaritan-card p-6">

      <h2 className="mb-4 text-zinc-100">
        Activity Timeline
      </h2>

      <div className="flex">

        {data.map((a: RibbonItem, i: number) => (

          <div
            key={i}
            style={{ width: `${a.duration/60000}px` }}
            className="h-8 bg-zinc-400 hover:bg-red-500 mr-1 transition-colors"
            title={`${a.appName} — ${a.intent}`}
          />

        ))}

      </div>

    </div>
  )
}
