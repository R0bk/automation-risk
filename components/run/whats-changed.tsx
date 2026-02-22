"use client";

import type { TopMover } from "@/lib/onet/catalog";

export interface TopMoverEntry extends TopMover {}

interface WhatsChangedProps {
  movers: TopMoverEntry[];
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

export function WhatsChanged({ movers }: WhatsChangedProps) {
  if (movers.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(245,78,0,0.06),_transparent_60%)]" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
            Jan 2025 → Nov 2025
          </p>
          <h2 className="mt-2 text-xl font-medium text-[#26251e] sm:text-2xl">
            What changed in AI task coverage
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[rgba(38,37,30,0.6)]">
            Roles with the biggest shifts in how many tasks AI can handle, based
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

      <div className="mt-8 rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
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
    </section>
  );
}
