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
  Goal
} from "lucide-react";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Heatmap", path: "/heatmap", icon: Flame },
  { name: "Focus Protocol", path: "/focus", icon: Timer },
  { name: "Projects", path: "/projects", icon: Target },
  { name: "Calendar", path: "/calendar", icon: CalendarIcon },
  { name: "Goals", path: "/goals", icon: Goal }
];

export default function Sidebar() {

  const pathname = usePathname();

  return (

    <aside
      className="
        relative
        z-40
        h-screen
        min-h-screen
        w-16
        shrink-0
        bg-[#0c0c0c]
        border-r
        border-zinc-800
        flex
        flex-col
      "
    >

      {/* HEADER */}
      <div className="h-16 flex items-center justify-center border-b border-zinc-800">
        <span
          className="
            flex h-8 w-8 items-center justify-center rounded-lg
            bg-purple-500/15 border border-purple-500/30
            text-purple-300 font-semibold text-sm
          "
          aria-hidden
        >
          S
        </span>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-2 py-6 space-y-2">

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
                rounded-lg
                transition-colors
                ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }
              `}
            >

              {/* ICON ALWAYS VISIBLE */}
              <Icon
                size={20}
                className={`shrink-0 ${
                  isActive ? "text-purple-400" : ""
                }`}
              />

              {/* FLOATING LABEL (only on hover - never reflows layout) */}
              <span
                className="
                  pointer-events-none
                  absolute
                  left-full
                  ml-2
                  whitespace-nowrap
                  rounded-md
                  border
                  border-zinc-800
                  bg-[#16161a]
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
      <div className="p-3 border-t border-zinc-800 text-[10px] text-zinc-500 text-center">
        v1.0
      </div>

    </aside>

  );

}