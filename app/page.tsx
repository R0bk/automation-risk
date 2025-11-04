import { Suspense } from "react";
import { Hero } from "@/components/run/hero";
import { MostViewedMarketplace } from "@/components/run/most-viewed-marketplace";
import { TrendingRuns } from "@/components/run/trending-runs";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketplacePage } from "@/lib/run/marketplace-types";
import {
  getRemainingCompanyRuns,
  listMostViewedRuns,
  listTrendingRuns,
} from "@/lib/db/queries";
import { ComparativeInsights } from "@/components/run/comparative-insights";
import { loadComparativeInsights } from "@/lib/run/load-comparative-insights";
import { Onboarding } from "@/components/run/onboarding";
import { ExplainButton } from "@/components/run/test2";
import { HelpMeUnderstandModalButton } from "@/components/run/test3";

const LANDING_FOOTER_LINKS = [
  { label: "Home", href: "#top" },
  { label: "Trending", href: "#trending" },
  { label: "Marketplace", href: "#marketplace" },
];

// ISR: Revalidate every 60 seconds (reduces server load by 50-80%)
export const revalidate = 60;

// Async component for trending runs
async function TrendingRunsAsync() {
  const trendingRows = await listTrendingRuns(8);
  const trending = trendingRows.map((entry) => ({
    runId: entry.runId,
    slug: entry.slug,
    displayName: entry.displayName,
    status: entry.status,
    viewCount: entry.viewCount ?? 1,
    updatedAt: entry.updatedAt?.toString() ?? null,
  }));

  return <TrendingRuns runs={trending} />;
}

// Async component for marketplace
async function MostViewedMarketplaceAsync() {
  const mostViewed = await listMostViewedRuns({ limit: 12, offset: 0, sortBy: "views" });
  const marketplaceInitial: MarketplacePage = {
    runs: mostViewed.runs.map((run) => ({
      runId: run.runId,
      slug: run.slug,
      displayName: run.displayName,
      status: run.status,
      viewCount: run.viewCount ?? 1,
      updatedAt: run.updatedAt,
      hqCountry: run.hqCountry,
      workforceMetric: run.workforceMetric,
    })),
    pagination: {
      limit: 12,
      offset: 0,
      nextOffset: mostViewed.hasMore ? 12 : null,
      hasMore: mostViewed.hasMore,
    },
  };

  return <MostViewedMarketplace initialPage={marketplaceInitial} pageSize={12} />;
}

// Async component for hero (fetches remaining runs)
async function HeroAsync() {
  const remainingRuns = await getRemainingCompanyRuns();
  return <Hero remainingRuns={remainingRuns} />;
}

async function ComparativeInsightsAsync() {
  const { data, updatedAt } = await loadComparativeInsights();
  return <ComparativeInsights analytics={data} updatedAt={updatedAt} />;
}

// Loading skeletons
function TrendingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 bg-[rgba(38,37,30,0.08)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
        ))}
      </div>
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 bg-[rgba(38,37,30,0.08)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
        ))}
      </div>
    </div>
  );
}

function ComparativeInsightsSkeleton() {
  return (
    <div className="rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.75)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10">
      <div className="space-y-4">
        <Skeleton className="h-4 w-36 rounded-full bg-[rgba(38,37,30,0.08)]" />
        <Skeleton className="h-6 w-2/3 rounded-full bg-[rgba(38,37,30,0.08)]" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl bg-[rgba(38,37,30,0.08)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      id="top"
      style={{ backgroundColor: "#f7f7f4" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,_rgba(31,138,101,0.08),_transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27 fill=%27none%27 viewBox=%270 0 120 120%27%3E%3Cpath stroke=%27%2326251e%27 stroke-opacity=%270.2%27 stroke-width=%270.6%27 d=%27M60 0v120M0 60h120%27/%3E%3C/svg%3E')",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-6 pb-32 pt-28 text-[#26251e]">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />}>
          <HeroAsync />
        </Suspense>
        <Onboarding />
        <ExplainButton />
        <HelpMeUnderstandModalButton/>
        <Suspense fallback={<ComparativeInsightsSkeleton />}>
          <ComparativeInsightsAsync />
        </Suspense>

        <div id="trending">
          <Suspense fallback={<TrendingSkeleton />}>
            <TrendingRunsAsync />
          </Suspense>
        </div>

        <div id="marketplace">
          <Suspense fallback={<MarketplaceSkeleton />}>
            <MostViewedMarketplaceAsync />
          </Suspense>
        </div>
      </main>

      <SiteFooter navLinks={LANDING_FOOTER_LINKS} />
    </div>
  );
}
