import { NextResponse } from "next/server";
import { listMostViewedRuns } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { MarketplaceRun } from "@/lib/run/marketplace-types";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 36;

function parseInteger(
  value: string | null,
  fallback: number,
  { min, max }: { min: number; max: number }
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new ChatSDKError("bad_request:api", "limit and offset must be integers");
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    console.log("[/api/run/marketplace] GET invoked", { url: request.url });
    const { searchParams } = new URL(request.url);
    const limit = parseInteger(searchParams.get("limit"), DEFAULT_LIMIT, {
      min: 1,
      max: MAX_LIMIT,
    });
    const offset = parseInteger(searchParams.get("offset"), 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    const sortParam = searchParams.get("sort");
    const sortBy = sortParam === "impact" ? "impact" : "views";
    const rawQuery = searchParams.get("query");
    const searchTerm = rawQuery && rawQuery.trim().length > 0 ? rawQuery.trim() : undefined;

    const { runs, hasMore } = await listMostViewedRuns({
      limit,
      offset,
      sortBy,
      searchTerm,
    });
    console.log("[/api/run/marketplace] query result", {
      runCount: runs.length,
      hasMore,
    });

    const normalizedRuns: MarketplaceRun[] = runs.map((run) => ({
      runId: run.runId,
      slug: run.slug,
      displayName: run.displayName,
      status: run.status,
      viewCount: run.viewCount ?? 1,
      updatedAt: run.updatedAt,
      hqCountry: run.hqCountry ?? null,
      workforceMetric: run.workforceMetric ?? null,
    }));

    const nextOffset = hasMore ? offset + normalizedRuns.length : null;

    return NextResponse.json({
      runs: normalizedRuns,
      pagination: {
        limit,
        offset,
        nextOffset,
        hasMore,
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error("Failed to load marketplace runs", error);

    return NextResponse.json(
      {
        code: "server_error:marketplace",
        message: "Unable to fetch most viewed runs right now. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}
