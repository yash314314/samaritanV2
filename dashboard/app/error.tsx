"use client";

import { CircleAlert, House, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route failed", error);
  }, [error]);

  return (
    <div className="dashboard-page py-3 text-zinc-100">
      <div className="dashboard-surface flex h-full items-center justify-center">
        <section className="samaritan-card w-full max-w-lg p-6" role="alert" aria-labelledby="route-error-title">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300">
              <CircleAlert size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="route-error-title" className="text-base font-semibold">This view could not load</h1>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Your tracking service is still running. Retry the view or return to the overview.
              </p>
              {error.digest && <p className="mt-2 text-[10px] text-zinc-700">Reference {error.digest}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-zinc-900 pt-4">
            <Link href="/" className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white">
              <House size={15} /> Overview
            </Link>
            <button type="button" onClick={reset} className="flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-3 text-sm font-medium transition hover:bg-purple-500">
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
