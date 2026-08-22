import { LoaderCircle } from "lucide-react";

const summaryWidths = ["w-14", "w-10", "w-16", "w-12"];
const rowWidths = ["w-36", "w-28", "w-40", "w-32", "w-24"];

export default function DashboardLoading() {
  return (
    <div className="dashboard-page py-3 text-zinc-100" role="status" aria-label="Loading dashboard">
      <div className="dashboard-surface flex h-full flex-col gap-3 animate-pulse">
        <header className="flex h-10 shrink-0 items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
              <LoaderCircle size={17} className="animate-spin text-purple-400" />
            </span>
            <div className="space-y-2">
              <div className="h-3 w-28 rounded bg-zinc-800" />
              <div className="h-2 w-40 rounded bg-zinc-900" />
            </div>
          </div>
          <div className="h-9 w-28 rounded-lg bg-zinc-900" />
        </header>

        <section className="samaritan-card grid min-h-0 flex-1 grid-rows-[58px_42px_minmax(0,1fr)]" aria-hidden="true">
          <div className="grid grid-cols-4 border-b border-zinc-900">
            {summaryWidths.map((width) => (
              <div key={width} className="flex items-center gap-3 border-r border-zinc-900 px-4 last:border-r-0">
                <div className="h-7 w-7 rounded-md bg-purple-500/10" />
                <div className="space-y-2">
                  <div className={`h-3 rounded bg-zinc-800 ${width}`} />
                  <div className="h-2 w-12 rounded bg-zinc-900" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 border-b border-zinc-900 px-4">
            <div className="h-2 w-14 rounded bg-purple-500/20" />
            <div className="h-2 w-14 rounded bg-zinc-900" />
            <div className="h-2 w-14 rounded bg-zinc-900" />
          </div>
          <div className="grid min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-zinc-900 p-4 lg:border-b-0 lg:border-r">
              <div className="space-y-5">
                {rowWidths.map((width, index) => (
                  <div key={`${width}-${index}`} className="space-y-2">
                    <div className={`h-3 rounded bg-zinc-800 ${width}`} />
                    <div className="h-2 w-full rounded bg-zinc-900" />
                  </div>
                ))}
              </div>
            </aside>
            <main className="grid min-h-0 content-start gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-4">
                <div className="h-4 w-44 rounded bg-zinc-800" />
                <div className="h-28 rounded-md bg-zinc-950" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-md bg-zinc-950" />
                  <div className="h-16 rounded-md bg-zinc-950" />
                  <div className="h-16 rounded-md bg-zinc-950" />
                </div>
              </div>
              <div className="h-48 rounded-md bg-zinc-950" />
              <div className="h-36 rounded-md bg-zinc-950 lg:col-span-2" />
            </main>
          </div>
        </section>
      </div>
      <span className="sr-only">Loading your latest tracking data</span>
    </div>
  );
}
