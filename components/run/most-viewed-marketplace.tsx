"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import type {
  MarketplacePage,
  MarketplaceRun,
} from "@/lib/run/marketplace-types";
import { fetcher } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import clsx from "clsx";

interface MostViewedMarketplaceProps {
  initialPage: MarketplacePage | null;
  pageSize?: number;
}

function buildMarketplaceKey(
  pageIndex: number,
  previousPageData: MarketplacePage | null,
  pageSize: number,
  query: string,
  sortBy: "views" | "impact"
) {
  if (previousPageData && previousPageData.pagination.hasMore === false) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("limit", String(pageSize));
  params.set("sort", sortBy);

  if (query) {
    params.set("query", query);
  }

  if (pageIndex === 0) {
    params.set("offset", "0");
    return `/api/run/marketplace?${params.toString()}`;
  }

  const nextOffset = previousPageData?.pagination.nextOffset;

  if (nextOffset === null || typeof nextOffset === "undefined") {
    return null;
  }

  params.set("offset", String(nextOffset));
  return `/api/run/marketplace?${params.toString()}`;
}

export function MostViewedMarketplace({
  initialPage,
  pageSize = 12,
}: MostViewedMarketplaceProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const didMountRef = useRef(false);
  const sortContainerRef = useRef<HTMLDivElement | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<"views" | "impact">("views");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedQuery((previous) => (previous === trimmed ? previous : trimmed));
    }, 350);
    return () => {
      window.clearTimeout(handle);
    };
  }, [searchTerm]);

  const shouldUseInitialFallback = Boolean(initialPage) && debouncedQuery === "" && sortBy === "views";

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
        pageSize,
        debouncedQuery,
        sortBy
      ),
    fetcher,
    {
      fallbackData: shouldUseInitialFallback && initialPage ? [initialPage] : undefined,
      revalidateOnFocus: false,
      revalidateOnMount: false,
      // Avoid refetching the first page each time we paginate; keeps the network
      // requests limited to the "next" page instead of repeating offset=0.
      revalidateFirstPage: false,
      revalidateAll: false,
    }
  );

  useEffect(() => {
    if (!sortOpen) return;
    const handleClick = (event: MouseEvent) => {
      const node = sortContainerRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sortOpen]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    isLoadingMoreRef.current = false;
    setSize(1);
  }, [debouncedQuery, sortBy, setSize]);

  const sourcePages =
    pages ?? (shouldUseInitialFallback && initialPage ? [initialPage] : []);
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

  const isInitialLoading = isLoading && runs.length === 0 && !shouldUseInitialFallback;
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

  const headerContent = (
    <header className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Most viewed
          </h2>
          <p className="mt-1 text-sm text-[rgba(38,37,30,0.55)]">
            Explore the runs with the highest attention or AI impact.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6 lg:w-auto">
          <div className="group relative w-full pb-0.5 mb-1.5 sm:w-[280px]">
            <label className="sr-only" htmlFor="marketplace-search">
              Search companies
            </label>
            <div className="relative">
              <Search size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-[rgba(38,37,30,0.38)]" />
              <input
                id="marketplace-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search companies"
                autoComplete="off"
                className="w-full bg-transparent pl-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.6)] placeholder:text-[rgba(38,37,30,0.38)] focus:text-[#26251e] focus:outline-none"
              />
            </div>
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[rgba(38,37,30,0.18)] transition duration-200 group-hover:bg-[rgba(38,37,30,0.3)] group-focus-within:bg-[#26251e]"
              aria-hidden
            />
          </div>
          <div
            ref={sortContainerRef}
            className="group relative flex w-full select-none justify-end pb-0.5 sm:w-auto sm:max-w-[220px]"
          >
            <button
              type="button"
              onClick={() => setSortOpen((next) => !next)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.6)] transition duration-200 hover:text-[#26251e]"
            >
              <span>{sortBy === "impact" ? "Sort: Highest impact" : "Sort: Most viewed"}</span>
              <ChevronDown size={12} className="text-[rgba(38,37,30,0.6)]" />
            </button>
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[rgba(38,37,30,0.18)] transition duration-200 group-hover:bg-[rgba(38,37,30,0.3)] group-focus-within:bg-[#26251e]"
              aria-hidden
            />
            {sortOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[240px] overflow-hidden rounded-xl border border-[rgba(38,37,30,0.12)] bg-white text-left shadow-[0_22px_46px_rgba(34,28,20,0.18)]">
                {[
                  { value: "views" as const, label: "Sort: Most viewed", description: "Prioritize view count and recency." },
                  { value: "impact" as const, label: "Sort: Highest impact", description: "Surface the strongest automation scores." },
                ].map((option) => {
                  const isActive = option.value === sortBy;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortBy(option.value);
                        setSortOpen(false);
                      }}
                      className={clsx(
                        "w-full px-4 py-3 text-left text-[11px] leading-[1.4]",
                        isActive
                          ? "bg-[rgba(38,37,30,0.08)] text-[#26251e]"
                          : "text-[rgba(38,37,30,0.65)] hover:bg-[rgba(38,37,30,0.05)]",
                      )}
                    >
                      <div className="font-semibold uppercase tracking-[0.24em]">{option.label}</div>
                      <div className="mt-1 text-[10px] normal-case tracking-normal text-[rgba(38,37,30,0.55)]">
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  if (isInitialLoading) {
    return (
      <section className="flex w-full flex-col gap-6">
        {headerContent}
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
    const emptyMessage = debouncedQuery
      ? `No companies match “${debouncedQuery}”. Try a different search or clear the filter.`
      : "No completed runs have been marked as most viewed yet. Check back after the next few reports finish.";

    return (
      <section className="flex w-full flex-col gap-6">
        {headerContent}
        <div className="rounded-[20px] border border-dashed border-[rgba(38,37,30,0.18)] bg-[rgba(241,240,236,0.6)] px-6 py-12 text-center text-sm text-[rgba(38,37,30,0.55)]">
          {emptyMessage}
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-6">
      {headerContent}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => {
          const slugOrId = run.slug ?? run.runId;
          const title = run.displayName ?? slugOrId;
          const updatedLabel = new Date(run.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const score = run.workforceMetric?.score ?? null;

          return (
            <Link
              key={run.runId}
              href={`/run/${slugOrId}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[rgba(38,37,30,0.1)] bg-[rgba(241,240,236,0.85)] px-6 py-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)] transition hover:border-[rgba(38,37,30,0.2)] hover:shadow-[0_26px_54px_rgba(34,28,20,0.16)]"
            >
              {score != null ? (
                <span
                  className="pointer-events-none absolute inset-y-0 right-0 text-[clamp(200px,22vw,260px)] font-semibold leading-[0.8] text-[rgba(38,37,30,0.03)] opacity-90 tracking-tight"
                  aria-hidden
                >
                  {score.toFixed(1)}
                </span>
              ) : null}

              <div className="relative z-10 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
                <span>Completed</span>
                <span className="font-mono text-[11px] text-[rgba(38,37,30,0.45)]">
                  {run.viewCount.toLocaleString()} views
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="relative z-10 flex min-w-0 flex-col gap-3">
                    <div className="text-lg font-semibold leading-tight text-[#26251e]">
                      {title}
                    </div>
                  </div>

                  {score != null ? (
                    <div className="relative z-10 shrink-0 text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-[clamp(24px,2vw,32px)] font-semibold text-[#26251e] leading-[0.5]">
                          {score.toFixed(1)}
                        </span>
                        <span className="text-base font-medium text-[rgba(38,37,30,0.55)]">/10</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <p className="relative z-10 flex items-center justify-between text-xs text-[rgba(38,37,30,0.55)]">
                  <span>Last updated {updatedLabel}</span>
                  <span className="text-[#f54e00] transition group-hover:translate-x-0.5 group-hover:text-[#ff9440]">
                    →
                  </span>
                </p>
              </div>
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
