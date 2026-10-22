"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const defaultSteps: TourStep[] = [
  {
    target: '[data-tour="date-controls"]',
    title: "Day controls",
    description: "Step between days, or click the date to pick one from the month.",
    position: "bottom",
  },
  {
    target: '[data-tour="sidebar-nav"]',
    title: "Navigation",
    description: "Overview, analytics, heatmap, focus sessions, projects, calendar, goals and reports. Settings, at the bottom, changes theme, colours and typeface.",
    position: "right",
  },
  {
    target: '[data-tour="user-controls"]',
    title: "Account and tour",
    description: "Sign in or out here. Tour replays this walkthrough at any time.",
    position: "bottom",
  },
];

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-start for first-time visitors in SamaritanV2
  useEffect(() => {
    const hasSeen = localStorage.getItem("samaritan_v2_tour_completed");
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const endTour = () => {
    setIsActive(false);
    localStorage.setItem("samaritan_v2_tour_completed", "true");
  };

  const nextStep = () => {
    if (currentStep < defaultSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps: defaultSteps,
        startTour,
        endTour,
        nextStep,
        prevStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
