"use client";

import { DeltaBadge } from "./delta-badge";

export interface TopMoverEntry {
  code: string;
  title: string;
  parentCluster: string | null;
  automationTasksBefore: number;
  automationTasksAfter: number;
  augmentationTasksBefore: number;
  augmentationTasksAfter: number;
  automationDelta: number;
  augmentationDelta: number;
  avgSuccessRate: number | null;
}

interface WhatsChangedProps {
  movers: TopMoverEntry[];
}

export function WhatsChanged({ movers }: WhatsChangedProps) {
  if (movers.length === 0) return null;

  return (
    <section
      className="rounded-[28px] border border-[rgba(38,37,30,0.12)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10"
      style={{
        backgroundImage: "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
            Jan 2025 → Nov 2025
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#26251e] sm:text-2xl">
            What changed in AI task coverage
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[rgba(38,37,30,0.6)]">
            Roles with the biggest shifts in automation and augmentation task counts between Anthropic&apos;s Economic Index v1 and v4.
          </p>
        </div>
        <a
          href="https://www.anthropic.com/research/the-anthropic-economic-index"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[rgba(38,37,30,0.14)] bg-white/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.6)] shadow-sm transition hover:border-[rgba(38,37,30,0.24)] hover:bg-white/80"
        >
          Anthropic Economic Index
        </a>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {movers.map((mover) => {
          const totalDelta = mover.automationDelta + mover.augmentationDelta;
          const isNetGrowth = totalDelta > 0;
          return (
            <div
              key={mover.code}
              className="rounded-2xl border border-[rgba(38,37,30,0.1)] bg-white/70 px-5 py-5 shadow-[0_14px_32px_rgba(34,28,20,0.08)] transition hover:shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#26251e]" title={mover.title}>
                    {mover.title}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[rgba(38,37,30,0.45)]">
                    {mover.code}
                    {mover.parentCluster && (
                      <span className="ml-2 normal-case tracking-normal">{mover.parentCluster}</span>
                    )}
                  </div>
                </div>
                {mover.avgSuccessRate != null && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-mono text-[rgba(38,37,30,0.55)]">
                      {Math.round(mover.avgSuccessRate * 100)}%
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-[rgba(38,37,30,0.35)]">
                      success
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#cf2d56]">Auto</span>
                  <span className="font-mono text-[rgba(38,37,30,0.6)]">
                    {mover.automationTasksBefore} → {mover.automationTasksAfter}
                  </span>
                  <DeltaBadge
                    value={mover.automationDelta}
                    sentiment="up-is-bad"
                    label="tasks"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#2d6fce]">Aug</span>
                  <span className="font-mono text-[rgba(38,37,30,0.6)]">
                    {mover.augmentationTasksBefore} → {mover.augmentationTasksAfter}
                  </span>
                  <DeltaBadge
                    value={mover.augmentationDelta}
                    sentiment="up-is-good"
                    label="tasks"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
