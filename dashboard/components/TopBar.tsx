"use client";

import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { DayPicker } from "react-day-picker";
import { format, startOfMonth, endOfMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import TourButton from "./TourButton";

const stepButtonClass =
  "flex h-7 w-7 items-center justify-center border border-control text-key transition-colors hover:border-signal hover:text-signal";

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

  return (
    <div className="sam-ui relative mb-5 flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-grid pb-3 pt-1">
      <div data-tour="date-controls" className="flex min-w-0 flex-wrap items-center gap-3">
        <button type="button" onClick={goToPrevious} className={stepButtonClass} aria-label="Previous day">
          <ChevronLeft size={14} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          aria-label="Choose a date"
          aria-expanded={showCalendar}
          className="flex min-w-0 items-baseline gap-3 px-1 text-left"
        >
          <span className="font-display text-[15px] uppercase tracking-[0.06em] text-signal">
            {format(selectedDate, "dd MMM yyyy")}
          </span>
          <span className="sam-key">
            {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}
          </span>
        </button>

        <button type="button" onClick={goToNext} className={stepButtonClass} aria-label="Next day">
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div data-tour="user-controls" className="flex items-center gap-3">
        <TourButton />

        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden flex-col text-right sm:flex">
              <span className="text-[12px] text-signal">{user.name}</span>
              <span className="text-[11px] text-key">{user.email}</span>
            </div>
            <button type="button" onClick={() => void logout()} className="sam-button">
              Log out
            </button>
          </div>
        ) : (
          <Link href="/login" className="sam-button">
            Sign in
          </Link>
        )}
      </div>

      {showCalendar && (
        <div className="absolute left-0 top-full z-50 mt-2 border border-grid bg-void p-4">
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
                color: "var(--sam-signal)",
                outline: "1px solid var(--sam-accent)",
                outlineOffset: "-1px",
                borderRadius: "0",
              },
              selected: {
                backgroundColor: "var(--sam-signal)",
                color: "var(--sam-void)",
                borderRadius: "0",
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
