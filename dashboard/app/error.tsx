"use client";

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
    <div className="sam-ui flex min-h-[60vh] items-center justify-center px-4">
      <section className="w-full max-w-md text-center" role="alert" aria-labelledby="route-error-title">
        <h1 id="route-error-title" className="!text-[20px]">View failed to load</h1>
        <div className="mx-auto mt-3 h-px w-48 bg-alert" aria-hidden />
        <p className="mx-auto mt-6 max-w-[40ch] text-[13px] leading-6 text-trace">
          Tracking is still running. Retry this view, or return to the overview.
        </p>
        {error.digest && <p className="mt-2 text-[11px] text-dim">Reference {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/" className="sam-button">
            Overview
          </Link>
          <button type="button" onClick={reset} className="sam-button" data-variant="primary">
            Retry
          </button>
        </div>
      </section>
    </div>
  );
}
