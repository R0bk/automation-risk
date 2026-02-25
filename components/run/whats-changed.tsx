"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { TopMover, CatalogChangeSummary } from "@/lib/onet/catalog";

export interface TopMoverEntry extends TopMover {}

interface WhatsChangedProps {
  movers: TopMoverEntry[];
  summary: CatalogChangeSummary;
}

const AUTOMATION_COLOR = "hsl(22deg 92% 48%)";
const AUGMENTATION_COLOR = "hsl(22deg 96% 66%)";

function TaskBar({
  automation,
  augmentation,
  total,
}: {
  automation: number;
  augmentation: number;
  total: number;
}) {
  if (total <= 0) return null;

  const autoPct = (automation / total) * 100;
  const augPct = (augmentation / total) * 100;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.07)]">
      <div
        className="flex h-full overflow-hidden rounded-full shadow-[0_4px_14px_rgba(245,78,0,0.18)]"
        style={{ width: `${Math.min(autoPct + augPct, 100)}%` }}
      >
        {autoPct > 0 && (
          <div
            className="flex-none"
            style={{
              width: `${(autoPct / (autoPct + augPct)) * 100}%`,
              backgroundColor: AUTOMATION_COLOR,
              minWidth: "3px",
            }}
          />
        )}
        {augPct > 0 && (
          <div
            className="flex-none"
            style={{
              width: `${(augPct / (autoPct + augPct)) * 100}%`,
              backgroundColor: AUGMENTATION_COLOR,
              minWidth: "3px",
            }}
          />
        )}
      </div>
    </div>
  );
}

const formatPctChange = (before: number, after: number) => {
  if (before === 0) return after > 0 ? "+100" : "0";
  const pct = Math.round(((after - before) / before) * 100);
  return pct > 0 ? `+${pct}` : `${pct}`;
};

const INDUSTRY_PREVIEW = 6;

export function WhatsChanged({ movers, summary }: WhatsChangedProps) {
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  if (movers.length === 0) return null;

  const autoDelta = summary.automationAfter - summary.automationBefore;
  const augDelta = summary.augmentationAfter - summary.augmentationBefore;
  const autoPctChange = formatPctChange(summary.automationBefore, summary.automationAfter);
  const augPctChange = formatPctChange(summary.augmentationBefore, summary.augmentationAfter);

  const industriesWithChanges = summary.industries.filter(
    (i) => i.rolesChanged > 0
  );
  const industryHasToggle = industriesWithChanges.length > INDUSTRY_PREVIEW;
  const displayedIndustries = showAllIndustries
    ? industriesWithChanges
    : industriesWithChanges.slice(0, INDUSTRY_PREVIEW);

  const maxIndustryAug = Math.max(
    ...industriesWithChanges.map((i) => Math.abs(i.augmentationDelta)),
    1
  );

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(245,78,0,0.06),_transparent_60%)]" />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
            Jan 2025 → Nov 2025
          </p>
          <h2 className="mt-2 text-xl font-medium text-[#26251e] sm:text-2xl">
            What changed in AI task coverage
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[rgba(38,37,30,0.6)]">
            How AI&apos;s role in {summary.totalRoles.toLocaleString()} occupations shifted, based
            on Anthropic&apos;s{" "}
            <a
              href="https://www.anthropic.com/research/the-anthropic-economic-index"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[rgba(245,78,0,0.85)] underline decoration-[rgba(245,78,0,0.4)] underline-offset-4 transition-colors hover:text-[rgba(245,78,0,1)]"
            >
              Economic Index
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(38,37,30,0.45)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: AUTOMATION_COLOR }}
            />
            Automation
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: AUGMENTATION_COLOR }}
            />
            Augmentation
          </span>
        </div>
      </header>

      {/* ── Aggregate shift ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
            Automation tasks
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: AUTOMATION_COLOR }}>
              {autoPctChange}%
            </span>
            <span className="text-xs text-[rgba(38,37,30,0.45)] tabular-nums">
              {summary.automationBefore.toLocaleString()} → {summary.automationAfter.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
            Augmentation tasks
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: AUGMENTATION_COLOR }}>
              {augPctChange}%
            </span>
            <span className="text-xs text-[rgba(38,37,30,0.45)] tabular-nums">
              {summary.augmentationBefore.toLocaleString()} → {summary.augmentationAfter.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
            Roles changed
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[#26251e]">
              {summary.rolesWithChanges.toLocaleString()}
            </span>
            <span className="text-xs text-[rgba(38,37,30,0.45)] tabular-nums">
              of {summary.totalRoles.toLocaleString()} ({Math.round((summary.rolesWithChanges / summary.totalRoles) * 100)}%)
            </span>
          </p>
        </div>
      </div>

      {/* ── Industry breakdown ── */}
      <div className="mt-8">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
          By industry
        </h3>
        <div className="mt-4 rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
          <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
            {displayedIndustries.map((ind) => {
              const netDelta = ind.automationDelta + ind.augmentationDelta;
              const augBarW =
                maxIndustryAug > 0
                  ? Math.max((Math.abs(ind.augmentationDelta) / maxIndustryAug) * 100, 2)
                  : 0;
              const autoBarW =
                maxIndustryAug > 0
                  ? Math.max((Math.abs(ind.automationDelta) / maxIndustryAug) * 100, 2)
                  : 0;

              return (
                <li key={ind.name} className="px-5 py-3.5 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[#26251e]">
                        {ind.name}
                      </span>
                      <span className="text-[10px] text-[rgba(38,37,30,0.4)]">
                        {ind.rolesChanged}/{ind.totalRoles} roles
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-semibold tabular-nums">
                      {ind.automationDelta !== 0 && (
                        <span style={{ color: AUTOMATION_COLOR }}>
                          {ind.automationDelta > 0 ? "+" : ""}
                          {ind.automationDelta} auto
                        </span>
                      )}
                      {ind.augmentationDelta !== 0 && (
                        <span style={{ color: AUGMENTATION_COLOR }}>
                          {ind.augmentationDelta > 0 ? "+" : ""}
                          {ind.augmentationDelta} aug
                        </span>
                      )}
                      {netDelta !== 0 && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor:
                              netDelta > 0
                                ? "rgba(245,78,0,0.08)"
                                : "rgba(38,37,30,0.06)",
                            color:
                              netDelta > 0
                                ? "hsl(22deg 90% 42%)"
                                : "rgba(38,37,30,0.55)",
                          }}
                        >
                          {netDelta > 0 ? "+" : ""}
                          {netDelta} net
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {ind.automationDelta !== 0 && (
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${autoBarW}%`,
                          backgroundColor: AUTOMATION_COLOR,
                          opacity: ind.automationDelta < 0 ? 0.35 : 1,
                          minWidth: "4px",
                        }}
                      />
                    )}
                    {ind.augmentationDelta !== 0 && (
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${augBarW}%`,
                          backgroundColor: AUGMENTATION_COLOR,
                          opacity: ind.augmentationDelta < 0 ? 0.35 : 1,
                          minWidth: "4px",
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {industryHasToggle && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={() => setShowAllIndustries((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(38,37,30,0.18)] bg-white/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-[rgba(38,37,30,0.6)] transition-shadow duration-200 hover:shadow-[0_12px_26px_rgba(34,28,20,0.16)]"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                {showAllIndustries
                  ? "Collapse"
                  : `Show all ${industriesWithChanges.length}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Role movers ── */}
      <div className="mt-8">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
          Biggest role shifts
        </h3>
        <div className="mt-4 rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
          <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
            {movers.map((mover, index) => {
              const aiTasksBefore =
                mover.automationTasksBefore + mover.augmentationTasksBefore;
              const aiTasksAfter =
                mover.automationTasksAfter + mover.augmentationTasksAfter;
              const netDelta = aiTasksAfter - aiTasksBefore;
              const aiPct =
                mover.taskCount > 0
                  ? Math.round((aiTasksAfter / mover.taskCount) * 100)
                  : 0;

              return (
                <li key={mover.code} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="flex-shrink-0 pt-0.5 text-right text-base font-semibold tracking-[0.18em] text-[rgba(38,37,30,0.3)]">
                      {(index + 1).toString().padStart(2, "\u2007")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-[#26251e]">
                            {mover.title}
                          </span>
                          {mover.parentCluster && (
                            <span className="ml-2 text-[10px] text-[rgba(38,37,30,0.4)]">
                              {mover.parentCluster}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-3 text-xs text-[rgba(38,37,30,0.55)]">
                          <span className="font-mono">
                            {aiTasksAfter} of {mover.taskCount} tasks
                          </span>
                          <span className="font-mono text-[rgba(38,37,30,0.38)]">
                            {aiPct}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <TaskBar
                            automation={mover.automationTasksAfter}
                            augmentation={mover.augmentationTasksAfter}
                            total={mover.taskCount}
                          />
                        </div>

                        {netDelta !== 0 && (
                          <span
                            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor:
                                netDelta > 0
                                  ? "rgba(245,78,0,0.08)"
                                  : "rgba(38,37,30,0.06)",
                              color:
                                netDelta > 0
                                  ? "hsl(22deg 90% 42%)"
                                  : "rgba(38,37,30,0.55)",
                            }}
                          >
                            {netDelta > 0 ? "+" : ""}
                            {netDelta} task{Math.abs(netDelta) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
