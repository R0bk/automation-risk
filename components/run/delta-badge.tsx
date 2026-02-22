"use client";

import { cn } from "@/lib/utils";

interface DeltaBadgeProps {
  /** The numeric change (positive = increase, negative = decrease) */
  value: number | null | undefined;
  /** Format: "pct" for percentage points, "count" for integers */
  format?: "pct" | "count";
  /** Contextual label, e.g. "since Jan 2025" */
  label?: string;
  /** Override color semantics: "up-is-bad" (default for automation), "up-is-good" */
  sentiment?: "up-is-bad" | "up-is-good" | "neutral";
  className?: string;
}

export function DeltaBadge({
  value,
  format = "count",
  label,
  sentiment = "neutral",
  className,
}: DeltaBadgeProps) {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return null;
  }

  const isPositive = value > 0;
  const arrow = isPositive ? "▲" : "▼";

  const formatted =
    format === "pct"
      ? `${isPositive ? "+" : ""}${(value * 100).toFixed(1)}%`
      : `${isPositive ? "+" : ""}${value}`;

  const colorClass =
    sentiment === "neutral"
      ? "text-muted-foreground"
      : sentiment === "up-is-bad"
        ? isPositive
          ? "text-red-500"
          : "text-emerald-500"
        : isPositive
          ? "text-emerald-500"
          : "text-red-500";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium leading-none",
        colorClass,
        className,
      )}
      title={label ? `${formatted} ${label}` : formatted}
    >
      <span className="text-[8px]">{arrow}</span>
      {formatted}
    </span>
  );
}
