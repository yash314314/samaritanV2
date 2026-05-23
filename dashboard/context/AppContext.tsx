"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { addDays, subDays } from "date-fns";

type AppContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  goToNext: () => void;
  goToPrevious: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const goToNext = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  const goToPrevious = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  return (
    <AppContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        goToNext,
        goToPrevious
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {

  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return ctx;
}