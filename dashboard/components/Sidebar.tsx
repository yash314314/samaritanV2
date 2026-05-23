"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Flame,
  Brain
} from "lucide-react";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Heatmap", path: "/heatmap", icon: Flame },
  { name: "Intelligence", path: "/intelligence", icon: Brain }
];

export default function Sidebar() {

  const pathname = usePathname();

  return (

    <aside
      className="
        group
        h-screen
        min-h-screen
        w-16
        hover:w-64
        transition-all
        duration-300
        bg-[#0c0c0c]
        border-r
        border-zinc-800
        flex
        flex-col
      "
    >

      {/* HEADER */}

      <div className="h-16 flex items-center px-4 border-b border-zinc-800">

        <span
          className="
            text-zinc-200
            font-semibold
            text-lg
            opacity-0
            group-hover:opacity-100
            transition
          "
        >
          Samaritan
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
              className={`
                flex
                items-center
                gap-4
                px-3
                py-3
                rounded-lg
                transition
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

              {/* LABEL */}

              <span
                className="
                  whitespace-nowrap
                  opacity-0
                  group-hover:opacity-100
                  transition
                  text-sm
                "
              >
                {item.name}
              </span>

            </Link>

          );

        })}

      </nav>

      {/* FOOTER */}

      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">

        <div className="opacity-0 group-hover:opacity-100 transition">
          Samaritan v1.0
          <div className="text-zinc-600">
            Personal cognitive OS
          </div>
        </div>

      </div>

    </aside>

  );

}