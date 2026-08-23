"use client";

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
  Settings
} from "lucide-react";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Heatmap", path: "/heatmap", icon: Flame },
  { name: "Focus Protocol", path: "/focus", icon: Timer },
  { name: "Projects", path: "/projects", icon: Target },
  { name: "Calendar", path: "/calendar", icon: CalendarIcon },
  { name: "Goals", path: "/goals", icon: Goal },
  { name: "Reports", path: "/reports", icon: FileText }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-[72px] shrink-0 flex-col border-r border-white/10 bg-[#0B0B0D]">
      {/* HEADER */}
      <div className="flex h-20 items-center justify-center border-b border-white/10">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#202024] text-sm font-semibold text-zinc-100 shadow-lg shadow-black/25"
          aria-hidden
        >
          S
        </span>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-2 px-3 py-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`group/nav
                relative
                flex
                items-center
                justify-center
                px-3
                py-3
                rounded-xl
                transition-colors
                ${
                  isActive
                    ? "bg-[#202024] text-zinc-100 ring-1 ring-white/10"
                    : "text-zinc-500 hover:bg-[#18181B] hover:text-zinc-200"
                }
              `}
            >
              <Icon
                size={20}
                className={`shrink-0 ${
                  isActive ? "text-[#A78BFA]" : ""
                }`}
              />

              <span
                className="
                  pointer-events-none
                  absolute
                  left-full
                  ml-2
                  whitespace-nowrap
                  rounded-md
                  border
                  border-white/10
                  bg-[#18181B]
                  px-3
                  py-1.5
                  text-sm
                  text-zinc-200
                  opacity-0
                  shadow-xl
                  transition-opacity
                  duration-150
                  group-hover/nav:opacity-100
                "
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-white/10 p-3 text-center text-zinc-500">
        <Settings className="mx-auto h-4 w-4" />
      </div>
    </aside>
  );
}
