"use client";

import { useCallback, useRef, useState } from "react";

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
  activeYear,
  onYearChange,
}: DataTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const resolveYearFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || points.length < 2) return null;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const index = Math.round(ratio * (points.length - 1));
      const point = points[index];
      return point?.available ? point.year : null;
    },
    [points]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const year = resolveYearFromX(e.clientX);
      if (year != null) onYearChange?.(year);
    },
    [resolveYearFromX, onYearChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const year = resolveYearFromX(e.clientX);
      if (year != null) onYearChange?.(year);
    },
    [dragging, resolveYearFromX, onYearChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (points.length === 0) return null;

  const activeIndex = points.findIndex((p) => p.year === activeYear);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(38,37,30,0.08)] bg-[rgba(247,247,244,0.92)] backdrop-blur-lg">
      <div className="mx-auto w-full max-w-[1200px] select-none px-6 py-4 sm:px-10">
        <div className="flex items-center gap-4">
          <p className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.4)]">
            Data vintage
          </p>

          {/* Track */}
          <div
            ref={trackRef}
            className="relative flex-1 touch-none"
            style={{ height: "36px" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Background line */}
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(38,37,30,0.1)]" />

            {/* Active segment fill */}
            {activeIndex > 0 && (
              <div
                className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(245,78,0,0.35)]"
                style={{
                  left: 0,
                  width: `${(activeIndex / (points.length - 1)) * 100}%`,
                }}
              />
            )}

            {/* Stops */}
            {points.map((point, i) => {
              const isActive = point.year === activeYear;
              const leftPct =
                points.length === 1
                  ? 50
                  : (i / (points.length - 1)) * 100;

              return (
                <button
                  key={point.year}
                  type="button"
                  disabled={!point.available}
                  onClick={() => {
                    if (point.available) onYearChange?.(point.year);
                  }}
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                  style={{ left: `${leftPct}%` }}
                >
                  {/* Dot */}
                  <div
                    className={`relative flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all duration-200 sm:h-3.5 sm:w-3.5 ${
                      isActive
                        ? "border-[rgba(245,78,0,0.9)] bg-[rgba(245,78,0,0.9)] shadow-[0_0_12px_rgba(245,78,0,0.35)]"
                        : point.available
                          ? "border-[rgba(38,37,30,0.25)] bg-white group-hover:border-[rgba(245,78,0,0.5)] group-hover:shadow-[0_0_8px_rgba(245,78,0,0.15)]"
                          : "border-[rgba(38,37,30,0.12)] bg-[rgba(38,37,30,0.04)]"
                    }`}
                  >
                    {isActive && (
                      <div className="h-1 w-1 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums transition-colors duration-200 ${
                      isActive
                        ? "top-5 font-semibold text-[rgba(245,78,0,0.9)]"
                        : point.available
                          ? "top-5 font-medium text-[rgba(38,37,30,0.55)] group-hover:text-[rgba(38,37,30,0.8)]"
                          : "top-5 font-medium text-[rgba(38,37,30,0.3)]"
                    }`}
                  >
                    {point.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
