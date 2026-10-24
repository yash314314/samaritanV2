"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import GuidedTour from "./GuidedTour";
import ElectronFocusBridge from "./ElectronFocusBridge";
import SmartBreakController from "./SmartBreakController";
import PageScrollBridge from "./PageScrollBridge";
import RouteStage from "./sam/RouteStage";
import AuthGate, { PUBLIC_ROUTES } from "./AuthGate";

// Routes that are embedded as small fixed-size frames and render on their own.
const BARE_ROUTES = new Set(["/widget"]);

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = (usePathname() || "/").replace(/(.)\/$/, "$1");

  if (BARE_ROUTES.has(pathname)) {
    return (
      <AuthGate>
        <div className="bg-void text-trace">{children}</div>
      </AuthGate>
    );
  }

  // Sign-in pages stand alone: no navigation into pages that need a session.
  if (PUBLIC_ROUTES.has(pathname)) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-void text-trace">{children}</div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <GuidedTour />
      <div className="flex min-h-screen bg-void text-trace">
        <ElectronFocusBridge />
        <SmartBreakController />
        <PageScrollBridge />
        <Sidebar />

        <main className="flex min-w-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
          <TopBar />
          <RouteStage className="min-h-0 flex-1 pb-8">{children}</RouteStage>
        </main>
      </div>
    </AuthGate>
  );
}
