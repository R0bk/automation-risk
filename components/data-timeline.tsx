"use client";

import { useState } from "react";

export type TimelinePoint = {
  year: number;
  label: string;
  available: boolean;
};

interface DataTimelineProps {
  points: TimelinePoint[];
  activeYear: number;
  onYearChange?: (year: number) => void;
}

export function DataTimeline({
  points,
  activeYear: initialYear,
  onYearChange,
}: DataTimelineProps) {
  const [activeYear, setActiveYear] = useState(initialYear);

  if (points.length === 0) return null;

  const handleSelect = (year: number) => {
    setActiveYear(year);
    onYearChange?.(year);
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,252,0.88)] px-1.5 py-1.5 shadow-[0_8px_32px_rgba(31,29,18,0.14),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-xl">
        {points.map((point, i) => {
          const isActive = point.year === activeYear;

          return (
            <button
              key={point.year}
              type="button"
              disabled={!point.available}
              onClick={() => {
                if (point.available) handleSelect(point.year);
              }}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold tabular-nums transition-all duration-200 focus:outline-none ${
                isActive
                  ? "bg-[rgba(245,78,0,0.1)] text-[rgba(245,78,0,0.9)] shadow-[0_2px_8px_rgba(245,78,0,0.12)]"
                  : point.available
                    ? "text-[rgba(38,37,30,0.5)] hover:bg-[rgba(38,37,30,0.04)] hover:text-[rgba(38,37,30,0.7)]"
                    : "cursor-default text-[rgba(38,37,30,0.25)]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(245,78,0,0.9)] shadow-[0_0_8px_rgba(245,78,0,0.3)]"
                    : point.available
                      ? "bg-[rgba(38,37,30,0.2)]"
                      : "bg-[rgba(38,37,30,0.1)]"
                }`}
              />
              {point.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
