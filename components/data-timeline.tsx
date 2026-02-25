"use client";

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
  if (points.length === 0) return null;

  const activeIndex = points.findIndex((p) => p.year === activeYear);

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-full border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,252,0.88)] px-5 py-3 shadow-[0_8px_32px_rgba(31,29,18,0.14),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-xl">
        {/* Track */}
        <div className="relative flex items-center" style={{ width: "160px", height: "36px" }}>
          {/* Background line */}
          <div className="absolute left-3 right-3 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(38,37,30,0.1)]" />

          {/* Active fill */}
          {activeIndex > 0 && (
            <div
              className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(245,78,0,0.35)] transition-all duration-300"
              style={{
                left: "12px",
                width: `${(activeIndex / (points.length - 1)) * (160 - 24)}px`,
              }}
            />
          )}

          {/* Dots + labels */}
          {points.map((point, i) => {
            const isActive = point.year === activeYear;
            const leftPx =
              points.length === 1
                ? 80
                : 12 + (i / (points.length - 1)) * (160 - 24);

            return (
              <button
                key={point.year}
                type="button"
                disabled={!point.available}
                onClick={() => {
                  if (point.available) onYearChange?.(point.year);
                }}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{ left: `${leftPx}px` }}
              >
                {/* Dot */}
                <div
                  className={`relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                    isActive
                      ? "border-[rgba(245,78,0,0.9)] bg-[rgba(245,78,0,0.9)] shadow-[0_0_10px_rgba(245,78,0,0.3)]"
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
                  className={`absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums transition-colors duration-200 ${
                    isActive
                      ? "font-semibold text-[rgba(245,78,0,0.9)]"
                      : point.available
                        ? "font-medium text-[rgba(38,37,30,0.5)] group-hover:text-[rgba(38,37,30,0.7)]"
                        : "font-medium text-[rgba(38,37,30,0.3)]"
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
  );
}
