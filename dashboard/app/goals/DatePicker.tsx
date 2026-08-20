"use client";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./date-picker.module.css";
import { forwardRef } from "react";

export const ThemedDatePicker = forwardRef<
  HTMLInputElement,
  {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
  }
>(({ selected, onChange, placeholder }, ref) => (
  <DatePicker
    selected={selected}
    onChange={onChange}
    placeholderText={placeholder}
    wrapperClassName="w-full"
    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-purple-500/50"
    calendarClassName={styles.calendar}
    ref={ref as any}
  />
));
