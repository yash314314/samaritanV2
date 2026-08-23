"use client";

import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { DayPicker } from "react-day-picker";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, User, LogOut, LogIn } from "lucide-react";
import Link from "next/link";

export default function TopBar() {
  const {
    selectedDate,
    setSelectedDate,
    goToNext,
    goToPrevious,
  } = useAppContext();

  const { user, logout } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const iconButtonClass = `
    p-2
    rounded-lg
    bg-[#202024]
    border
    border-white/10
    hover:bg-[#27272A]
    transition
    text-zinc-300
    [&_svg]:text-zinc-300
  `;

  return (
    <div className="
      relative
      flex
      flex-wrap
      items-center
      justify-between
      gap-3
      mb-5
      rounded-2xl
      border
      border-white/10
      bg-[#18181B]
      px-4
      py-3
      shadow-[0_16px_42px_rgba(0,0,0,0.28)]
      shrink-0
    ">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button
          onClick={goToPrevious}
          className={iconButtonClass}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="min-w-0 text-base font-semibold tracking-tight text-zinc-100">
          {format(selectedDate, "MMMM d, yyyy")}
        </div>

        <button
          onClick={goToNext}
          className={iconButtonClass}
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>

        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={`ml-2 ${iconButtonClass}`}
          aria-label="Open calendar"
        >
          <Calendar size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-3">
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-200">{user.name}</span>
              <span className="text-[10px] text-zinc-400">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#202024] hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 text-xs font-medium text-zinc-300 flex items-center space-x-1.5 transition"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </Link>
        )}
      </div>

      {showCalendar && (
        <div className="
          absolute
          top-16
          left-0
          bg-[#18181B]
          border
          border-white/10
          p-4
          rounded-xl
          shadow-2xl
          z-50
        ">
          <DayPicker
            mode="single"
            selected={selectedDate}
            month={selectedDate}
            startMonth={monthStart}
            endMonth={monthEnd}
            showOutsideDays={false}
            disabled={[
              { before: monthStart },
              { after: monthEnd },
            ]}
            modifiersStyles={{
              today: {
                color: "#ffffff",
                fontWeight: "700",
                border: "2px solid rgb(255, 255, 255)",
                borderRadius: "8px",
              },
              selected: {
                backgroundColor: "#b983ff",
                color: "#000000",
                borderRadius: "8px",
              },
            }}
            onSelect={(date) => {
              if (!date) return;

              setSelectedDate(date);
              setShowCalendar(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
