"use client";

import { useTour } from "../context/TourContext";

export default function TourButton() {
  const { startTour, isActive } = useTour();

  return (
    <button
      type="button"
      onClick={startTour}
      disabled={isActive}
      className="sam-button shrink-0"
      title="Walk through the dashboard"
    >
      Tour
    </button>
  );
}
