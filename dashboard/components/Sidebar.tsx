"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Flame,
  Timer,
  Target,
  Calendar as CalendarIcon,
  Goal,
  FileText,
  SlidersHorizontal,
} from "lucide-react";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Heatmap", path: "/heatmap", icon: Flame },
  { name: "Focus Protocol", path: "/focus", icon: Timer },
  { name: "Projects", path: "/projects", icon: Target },
  { name: "Calendar", path: "/calendar", icon: CalendarIcon },
  { name: "Goals", path: "/goals", icon: Goal },
  { name: "Reports", path: "/reports", icon: FileText },
];

const settingsItem = { name: "Settings", path: "/settings", icon: SlidersHorizontal };

export default function Sidebar() {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  // One triangle marks the current route and slides between items, measured
  // against the reserved slot of the active link. The first placement is not
  // animated.
  useLayoutEffect(() => {
    const aside = asideRef.current;
    const marker = markerRef.current;
    if (!aside || !marker) return;
    const place = () => {
      const slot = aside.querySelector<HTMLElement>('[aria-current="page"] [data-nav-slot]');
      const rect = slot?.getBoundingClientRect();
      if (!slot || !rect || rect.width === 0) {
        marker.style.visibility = "hidden";
        return;
      }
      const frame = aside.getBoundingClientRect();
      marker.style.transform = `translate(${rect.left - frame.left}px, ${rect.top - frame.top + rect.height / 2 - 4}px)`;
      marker.style.visibility = "visible";
    };
    place();
    const ready = requestAnimationFrame(() => marker.setAttribute("data-ready", ""));
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(ready);
      window.removeEventListener("resize", place);
    };
  }, [pathname]);

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = pathname === item.path;

    return (
      <Link
        key={item.path}
        href={item.path}
        title={item.name}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center justify-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-[0.1em] transition-colors lg:justify-start ${
          isActive ? "text-signal" : "text-key hover:text-trace"
        }`}
      >
        {/* Reserved slot for the route marker, so labels never shift. */}
        <span data-nav-slot className="hidden w-1.5 shrink-0 lg:inline-flex" aria-hidden />
        <Icon size={16} strokeWidth={1.5} className="shrink-0 lg:hidden" aria-hidden />
        <span className="hidden truncate lg:inline">{item.name}</span>
      </Link>
    );
  };

  return (
    <aside ref={asideRef} className="sam-ui sticky top-0 z-40 flex h-screen w-14 shrink-0 flex-col border-r border-grid bg-void lg:w-48">
      <span
        ref={markerRef}
        aria-hidden
        className="sam-nav-marker pointer-events-none invisible absolute left-0 top-0 hidden lg:block"
      >
        <span className="sam-triangle-right block" />
      </span>
      <div className="flex h-[68px] items-center justify-center gap-3 px-4 lg:justify-start">
        <span className="sam-triangle" aria-hidden />
        <span className="hidden font-display text-[13px] tracking-[0.12em] text-signal lg:inline">
          SAMARITAN
        </span>
      </div>

      <nav data-tour="sidebar-nav" aria-label="Main" className="flex-1 py-3">
        {navItems.map(renderItem)}
      </nav>

      <nav aria-label="Preferences" className="border-t border-grid py-3">
        {renderItem(settingsItem)}
      </nav>
    </aside>
  );
}
