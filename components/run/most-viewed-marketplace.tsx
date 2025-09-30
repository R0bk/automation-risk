"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import type { MarketplacePage, MarketplaceRun } from "@/lib/run/marketplace-types";
import { fetcher } from "@/lib/utils";

interface MostViewedMarketplaceProps {
  initialPage: MarketplacePage | null;
  pageSize?: number;
}

function buildMarketplaceKey(
  pageIndex: number,
  previousPageData: MarketplacePage | null,
  pageSize: number
) {
  if (previousPageData && previousPageData.pagination.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `/api/run/marketplace?limit=${pageSize}&offset=0`;
  }

  const nextOffset = previousPageData?.pagination.nextOffset;

  if (nextOffset === null || typeof nextOffset === "undefined") {
    return null;
  }

  return `/api/run/marketplace?limit=${pageSize}&offset=${nextOffset}`;
}

export function MostViewedMarketplace({
  initialPage,
  pageSize = 12,
}: MostViewedMarketplaceProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);

  const {
    data: pages,
    setSize,
    isValidating,
    isLoading,
  } = useSWRInfinite<MarketplacePage>(
    (pageIndex, previousPageData) =>
      buildMarketplaceKey(
        pageIndex,
        previousPageData ?? null,
        pageSize
      ),
    fetcher,
    {
      fallbackData: initialPage ? [initialPage] : undefined,
      revalidateOnFocus: false,
    }
  );

  const sourcePages = pages ?? (initialPage ? [initialPage] : []);
  const lastPage = sourcePages.at(-1) ?? null;
  const hasMore = lastPage?.pagination.hasMore ?? false;

  const runs = useMemo(() => {
    const seen = new Set<string>();
    const aggregated: MarketplaceRun[] = [];

    for (const page of sourcePages) {
      if (!page) continue;

      for (const run of page.runs) {
        if (seen.has(run.runId)) {
          continue;
        }
        seen.add(run.runId);
        aggregated.push(run);
      }
    }

    return aggregated;
  }, [sourcePages]);

  const isInitialLoading = isLoading && runs.length === 0;
  const isFetchingMore = isValidating && runs.length > 0 && hasMore;

  useEffect(() => {
    if (!hasMore) {
      return;
    }

    const node = sentinelRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        if (isLoadingMoreRef.current) {
          return;
        }

        isLoadingMoreRef.current = true;
        setSize((size) => size + 1);
      },
      {
        rootMargin: "240px",
        threshold: 0.1,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, setSize]);

  useEffect(() => {
    if (!isValidating) {
      isLoadingMoreRef.current = false;
    }
  }, [isValidating]);

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setSize((size) => size + 1);
  };

  if (isInitialLoading) {
    return (
      <section className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Most viewed
          </h2>
          <p className="text-sm text-[rgba(38,37,30,0.55)]">
            Discover the automation reports teams return to again and again.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] rounded-[20px] border border-[rgba(38,37,30,0.08)] bg-[rgba(241,240,236,0.6)] shadow-[0_18px_40px_rgba(34,28,20,0.08)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!runs.length) {
    return (
      <section className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Most viewed
          </h2>
          <p className="text-sm text-[rgba(38,37,30,0.55)]">
            Completed runs will appear here once teams start revisiting their favorite replays.
          </p>
        </header>
        <div className="rounded-[20px] border border-dashed border-[rgba(38,37,30,0.18)] bg-[rgba(241,240,236,0.6)] px-6 py-12 text-center text-sm text-[rgba(38,37,30,0.55)]">
          No completed runs have been marked as most viewed yet. Check back after the next few reports finish.
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
              Most viewed
            </h2>
            <p className="mt-1 text-sm text-[rgba(38,37,30,0.55)]">
              Explore the automations with the highest replay traffic. If no standouts yet, we surface the freshest completed runs.
            </p>
          </div>
          <span className="text-xs text-[rgba(38,37,30,0.45)]">
            Showing {runs.length.toLocaleString()} run{runs.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => {
          const slugOrId = run.slug ?? run.runId;
          const title = run.displayName ?? slugOrId;
          const updatedLabel = new Date(run.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <Link
              key={run.runId}
              href={`/run/${slugOrId}`}
              className="group flex h-full flex-col rounded-[20px] border border-[rgba(38,37,30,0.1)] bg-[rgba(241,240,236,0.85)] px-6 py-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)] transition hover:border-[rgba(38,37,30,0.2)] hover:shadow-[0_26px_54px_rgba(34,28,20,0.16)]"
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
                <span>Completed</span>
                <span className="font-mono text-[11px] text-[rgba(38,37,30,0.45)]">
                  {run.viewCount.toLocaleString()} views
                </span>
              </div>

              <div className="mt-4 text-lg font-semibold leading-tight text-[#26251e]">
                {title}
              </div>

              {run.hqCountry ? (
                <div className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[rgba(38,37,30,0.45)]">
                  <span className="rounded-full bg-[rgba(38,37,30,0.08)] px-3 py-1">{run.hqCountry}</span>
                </div>
              ) : null}

              <p className="mt-4 flex items-center justify-between text-xs text-[rgba(38,37,30,0.55)]">
                <span>Last updated {updatedLabel}</span>
                <span className="text-[#f54e00] transition group-hover:translate-x-0.5 group-hover:text-[#ff9440]">
                  →
                </span>
              </p>
            </Link>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-0.5 w-full" aria-hidden />

      {hasMore ? (
        <div className="flex items-center justify-center">
          <button
            type="button"
            className="rounded-full border border-[rgba(38,37,30,0.2)] bg-white px-5 py-2 text-sm font-medium text-[#26251e] transition hover:border-[rgba(38,37,30,0.35)] hover:shadow-[0_12px_24px_rgba(34,28,20,0.12)]"
            onClick={handleLoadMore}
            disabled={isFetchingMore}
          >
            {isFetchingMore ? "Loading more runs..." : "Load more runs"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
