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
    title: "Date & Timeline Navigation",
    description: "Navigate through daily productivity logs, change dates, and open calendar views to inspect past focus performance.",
    position: "bottom",
  },
  {
    target: '[data-tour="sidebar-nav"]',
    title: "SamaritanV2 Navigation Dock",
    description: "Switch seamlessly between Overview, Analytics, Productivity Heatmap, Focus Protocol, Projects, Calendar, Goals, and Reports.",
    position: "right",
  },
  {
    target: '[data-tour="user-controls"]',
    title: "User Profile & Tour Launch",
    description: "Manage active user sessions, credentials, and re-launch this guided tour anytime by clicking the Tour button.",
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
