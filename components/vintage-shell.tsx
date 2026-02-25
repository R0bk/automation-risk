"use client";

import { useState } from "react";
import { DataTimeline, type TimelinePoint } from "@/components/data-timeline";
import { WhatsChanged } from "@/components/run/whats-changed";
import { ComparativeInsights } from "@/components/run/comparative-insights";
import type { TopMover, CatalogChangeSummary, CatalogTransitions, VintageAggregates, VintageAggregate } from "@/lib/onet/catalog";
import type { ComparativeAnalytics } from "@/lib/run/comparative-analytics-types";

const TIMELINE_POINTS: TimelinePoint[] = [
  { year: 2025.0, label: "Jan 2025", available: true },
  { year: 2025.9, label: "Nov 2025", available: true },
];

const AUTOMATION_COLOR = "hsl(22deg 92% 48%)";
const AUGMENTATION_COLOR = "hsl(22deg 96% 66%)";
const MANUAL_COLOR = "rgba(38,37,30,0.35)";

interface VintageShellProps {
  movers: TopMover[];
  summary: CatalogChangeSummary;
  transitions: CatalogTransitions;
  analyticsV4: ComparativeAnalytics | null;
  analyticsV1: ComparativeAnalytics | null;
  updatedAt: string | null;
  vintageAggregates: VintageAggregates;
}

export function VintageShell({
  movers,
  summary,
  transitions,
  analyticsV4,
  analyticsV1,
  updatedAt,
  vintageAggregates,
}: VintageShellProps) {
  const [activeYear, setActiveYear] = useState(2025.9);

  const isV1 = activeYear === 2025.0;
  const currentAgg = isV1 ? vintageAggregates.v1 : vintageAggregates.v4;
  const vintageLabel = isV1 ? "January 2025" : "November 2025";

  // Use the v1 snapshot if available, otherwise fall back to v4
  const displayAnalytics = isV1 ? (analyticsV1 ?? analyticsV4) : analyticsV4;

  return (
    <>
      <div id="whats-changed" className="transition-all duration-300">
        {isV1 ? (
          <VintageBaselineCard
            aggregate={currentAgg}
            label={vintageLabel}
            comparisonAggregate={vintageAggregates.v4}
          />
        ) : (
          <WhatsChanged
            movers={movers}
            summary={summary}
            transitions={transitions}
            analytics={analyticsV4}
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

// ── Baseline snapshot card (shown for Jan 2025) ─────────────

function VintageBaselineCard({
  aggregate,
  label,
  comparisonAggregate,
}: {
  aggregate: VintageAggregate;
  label: string;
  comparisonAggregate: VintageAggregate;
}) {
  const totalAI = aggregate.automationTasks + aggregate.augmentationTasks;
  const totalTasks = totalAI + aggregate.manualTasks;
  const aiPct = totalTasks > 0 ? Math.round((totalAI / totalTasks) * 100) : 0;
  const autoPct = totalTasks > 0 ? Math.round((aggregate.automationTasks / totalTasks) * 100) : 0;
  const augPct = totalTasks > 0 ? Math.round((aggregate.augmentationTasks / totalTasks) * 100) : 0;

  const compTotal = comparisonAggregate.automationTasks + comparisonAggregate.augmentationTasks + comparisonAggregate.manualTasks;
  const compAiPct = compTotal > 0
    ? Math.round(((comparisonAggregate.automationTasks + comparisonAggregate.augmentationTasks) / compTotal) * 100)
    : 0;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(245,78,0,0.06),_transparent_60%)]" />

      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
          {label} · Baseline
        </p>
        <h2 className="mt-2 text-xl font-medium text-[#26251e] sm:text-2xl">
          AI task coverage snapshot
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[rgba(38,37,30,0.6)]">
          This is the baseline from Anthropic&apos;s{" "}
          <a
            href="https://www.anthropic.com/research/the-anthropic-economic-index"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[rgba(245,78,0,0.85)] underline decoration-[rgba(245,78,0,0.4)] underline-offset-4 transition-colors hover:text-[rgba(245,78,0,1)]"
          >
            Economic Index
          </a>{" "}
          v1 data. Switch to Nov 2025 to see what changed.
        </p>
      </header>

      {/* Big picture cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Roles" value={aggregate.totalRoles.toLocaleString()} />
        <StatCard
          label="AI coverage"
          value={`${aiPct}%`}
          sublabel={compAiPct !== aiPct ? `→ ${compAiPct}% in Nov` : undefined}
        />
        <StatCard
          label="Automation tasks"
          value={aggregate.automationTasks.toLocaleString()}
          sublabel={`${autoPct}% of all`}
        />
        <StatCard
          label="Augmentation tasks"
          value={aggregate.augmentationTasks.toLocaleString()}
          sublabel={`${augPct}% of all`}
        />
      </div>

      {/* Composition bar */}
      <div className="mt-8">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
          Task composition
        </h3>
        <div className="h-5 w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.06)]">
          <div className="flex h-full">
            {autoPct > 0 && (
              <div
                className="flex-none transition-all duration-500"
                style={{ width: `${autoPct}%`, backgroundColor: AUTOMATION_COLOR }}
              />
            )}
            {augPct > 0 && (
              <div
                className="flex-none transition-all duration-500"
                style={{ width: `${augPct}%`, backgroundColor: AUGMENTATION_COLOR }}
              />
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(38,37,30,0.45)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: AUTOMATION_COLOR }} />
            Automation {autoPct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: AUGMENTATION_COLOR }} />
            Augmentation {augPct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MANUAL_COLOR }} />
            Manual {totalTasks > 0 ? 100 - autoPct - augPct : 0}%
          </span>
        </div>
      </div>

      {/* Industry breakdown */}
      {aggregate.byIndustry.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
            By industry
          </h3>
          <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
            <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
              {aggregate.byIndustry.slice(0, 10).map((ind) => {
                const indTotal = ind.automationTasks + ind.augmentationTasks + ind.manualTasks;
                const indAutoPct = indTotal > 0 ? (ind.automationTasks / indTotal) * 100 : 0;
                const indAugPct = indTotal > 0 ? (ind.augmentationTasks / indTotal) * 100 : 0;

                return (
                  <li key={ind.name} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-[#26251e]">{ind.name}</span>
                        <span className="text-[10px] text-[rgba(38,37,30,0.4)]">{ind.totalRoles} roles</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[rgba(38,37,30,0.5)]">
                        {Math.round(indAutoPct + indAugPct)}% AI
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.06)]">
                      <div className="flex h-full" style={{ width: `${Math.min(indAutoPct + indAugPct, 100)}%` }}>
                        {indAutoPct > 0 && (
                          <div
                            className="flex-none"
                            style={{ width: `${(indAutoPct / (indAutoPct + indAugPct)) * 100}%`, backgroundColor: AUTOMATION_COLOR, minWidth: "3px" }}
                          />
                        )}
                        {indAugPct > 0 && (
                          <div
                            className="flex-none"
                            style={{ width: `${(indAugPct / (indAutoPct + indAugPct)) * 100}%`, backgroundColor: AUGMENTATION_COLOR, minWidth: "3px" }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">{value}</p>
      {sublabel && (
        <p className="mt-0.5 text-[10px] text-[rgba(38,37,30,0.4)]">{sublabel}</p>
      )}
    </div>
  );
}
