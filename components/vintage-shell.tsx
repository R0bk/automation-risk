"use client";

import { useState } from "react";
import { DataTimeline, type TimelinePoint } from "@/components/data-timeline";
import { WhatsChanged } from "@/components/run/whats-changed";
import { ComparativeInsights } from "@/components/run/comparative-insights";
import type { TopMover, CatalogChangeSummary, CatalogTransitions } from "@/lib/onet/catalog";
import type { ComparativeAnalytics } from "@/lib/run/comparative-analytics-types";

const TIMELINE_POINTS: TimelinePoint[] = [
  { year: 2025.0, label: "Jan 2025", available: true },
  { year: 2025.7, label: "Sep 2025", available: true },
  { year: 2025.9, label: "Nov 2025", available: true },
];

interface VintageShellProps {
  movers: TopMover[];
  summary: CatalogChangeSummary;
  transitions: CatalogTransitions;
  analyticsV4: ComparativeAnalytics | null;
  analyticsV3: ComparativeAnalytics | null;
  analyticsV1: ComparativeAnalytics | null;
  updatedAt: string | null;
}

export function VintageShell({
  movers,
  summary,
  transitions,
  analyticsV4,
  analyticsV3,
  analyticsV1,
  updatedAt,
}: VintageShellProps) {
  const [activeYear, setActiveYear] = useState(2025.9);

  const isV1 = activeYear === 2025.0;
  const isV4 = activeYear === 2025.9;

  // Use the matching vintage snapshot, falling back to v4
  const displayAnalytics = isV1
    ? (analyticsV1 ?? analyticsV4)
    : activeYear === 2025.7
      ? (analyticsV3 ?? analyticsV4)
      : analyticsV4;

  return (
    <>
      <div id="whats-changed" className="transition-all duration-300">
        {(isV4 || activeYear === 2025.7) && (
          <WhatsChanged
            movers={movers}
            summary={summary}
            transitions={transitions}
            analytics={analyticsV4}
            analyticsV3={analyticsV3}
            analyticsV1={analyticsV1}
            activeVintage={activeYear}
          />
        )}
      </div>

      <ComparativeInsights analytics={displayAnalytics} updatedAt={updatedAt} />

      <DataTimeline
        points={TIMELINE_POINTS}
        activeYear={activeYear}
        onYearChange={setActiveYear}
      />
    </>
  );
}
