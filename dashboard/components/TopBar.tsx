"use client";

import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { DayPicker } from "react-day-picker";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export default function TopBar() {
  const {
    selectedDate,
    setSelectedDate,
    goToNext,
    goToPrevious,
  } = useAppContext();

  const [showCalendar, setShowCalendar] = useState(false);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const iconButtonClass = `
    p-2
    rounded-lg
    bg-zinc-900
    border
    border-zinc-800
    hover:bg-zinc-800
    transition
    text-white
    [&_svg]:text-white
  `;

  return (
    <div className="
      relative
      flex
      items-center
      justify-between
      mb-8
      border-b
      border-zinc-800
      pb-5
    ">
      <div className="flex items-center gap-4">
        <button
          onClick={goToPrevious}
          className={iconButtonClass}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-lg font-semibold tracking-tight text-zinc-200">
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

      <div className="text-xs text-zinc-500">
        Samaritan Intelligence
      </div>

      {showCalendar && (
        <div className="
          absolute
          top-16
          left-0
          bg-[#0f0f0f]
          border
          border-zinc-800
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
      border: "2px solidrgb(255, 255, 255)",
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