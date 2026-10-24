"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import SamLoading from "./sam/SamLoading";

export const PUBLIC_ROUTES = new Set(["/login", "/register"]);

/** Only same-site paths are honoured as a post-login destination (no open redirects). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return PUBLIC_ROUTES.has(raw.split(/[?#]/)[0]) ? "/" : raw;
}

/**
 * Keeps signed-out visitors on the sign-in pages and signed-in users off them.
 * Pages render only once a session exists, so their data requests always
 * carry a token.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = (usePathname() || "/").replace(/(.)\/$/, "$1");
  const isPublic = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
    } else if (user && isPublic) {
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    }
  }, [loading, user, isPublic, router]);

  if (loading || (!user && !isPublic) || (user && isPublic)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
        <SamLoading label={loading ? "Verifying session" : "Redirecting"} />
      </div>
    );
  }
  return <>{children}</>;
}
