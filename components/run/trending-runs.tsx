import Link from "next/link";

interface TrendingRun {
  runId: string;
  slug: string | null;
  displayName: string | null;
  status: string | null;
  viewCount: number;
  updatedAt: string | Date | null;
}

interface TrendingRunsProps {
  runs: TrendingRun[];
}

export function TrendingRuns({ runs }: TrendingRunsProps) {
  return (
    <section className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
          Recently explored companies
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-block size-1 animate-pulse rounded-full bg-red-300" aria-hidden />
          <span className="text-xs text-[rgba(38,37,30,0.4)]">Live</span>
        </div>
      </div>

      <div className="relative -mx-4">
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px] border border-[rgba(38,37,30,0.1)]"
          style={{
            backgroundImage: "linear-gradient(135deg, rgba(244,243,239,0.96), rgba(236,234,228,0.92))",
          }}
        />
        <div className="relative overflow-x-auto px-4 py-6">
          <div className="flex gap-5">
            {(runs && runs.length > 0 ? runs : placeholderRuns).map((run) => {
              const slug = run.slug ?? run.runId;
              const title = run.displayName ?? slug;
              const statusLabel = getStatusLabel(run.status);
              const updatedCaption = run.updatedAt
                ? new Date(run.updatedAt).toLocaleDateString()
                : "Awaiting first run";
              const isPlaceholder = run.runId.startsWith("placeholder");
              const CardComponent = isPlaceholder ? "div" : Link;

              return (
                <CardComponent
                  key={run.runId}
                  {...(!isPlaceholder ? { href: `/run/${slug}` } : {})}
                  className="group min-w-[260px] rounded-[18px] border border-[rgba(38,37,30,0.1)] px-5 py-6 shadow-[0_20px_48px_rgba(34,28,20,0.14)] transition hover:border-[rgba(38,37,30,0.18)] hover:shadow-[0_26px_58px_rgba(34,28,20,0.18)]"
                  style={{
                    backgroundImage: "linear-gradient(150deg, rgba(242,241,237,0.94), rgba(235,233,227,0.88))",
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
                    <span>{statusLabel}</span>
                    <span className="font-mono text-[11px] text-[rgba(38,37,30,0.45)]">
                      {run.viewCount.toLocaleString()} views
                    </span>
                  </div>
                  <div className="mt-4 text-lg font-semibold text-[#26251e]">
                    {title}
                  </div>
                  <div className="mt-2 text-xs text-[rgba(38,37,30,0.55)]">Updated {updatedCaption}</div>
                  <div className="mt-6 flex items-center justify-between text-xs text-[rgba(38,37,30,0.45)]">
                    <span>{isPlaceholder ? "Waiting for first run" : "Open report"}</span>
                    <span className="text-[#f54e00] transition group-hover:text-[#ff9440]">→</span>
                  </div>
                </CardComponent>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const placeholderRuns: TrendingRun[] = [
  {
    runId: "placeholder-1",
    slug: "",
    displayName: "Add your first company",
    status: "queued",
    viewCount: 0,
    updatedAt: null,
  },
];

function getStatusLabel(status: string | null) {
  switch (status) {
    case "completed":
      return "Completed";
    case "running":
      return "In flight";
    case "pending":
      return "Queued";
    default:
      return "Queued";
  }
}
