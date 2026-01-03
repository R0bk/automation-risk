import { config } from "dotenv";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LANDING_ANALYTICS_SNAPSHOT_KEY } from "@/lib/constants/analytics";
import {
  analysisRun,
  analyticsSnapshot,
  company,
  runMetric,
} from "@/lib/db/schema";
import {
  buildComparativeAnalytics,
} from "@/lib/run/comparative-analytics";
import {
  type ComparativeRun,
} from "@/lib/run/comparative-analytics-types";
import { enrichedOrgReportSchema } from "@/lib/run/report-schema";
import {
  computeWorkforceImpact,
  parseWorkforceMetricData,
  type WorkforceImpactSnapshot,
} from "@/lib/run/workforce-impact";

config({ path: ".env.local" });

if (!process.env.POSTGRES_URL) {
  console.error(
    "POSTGRES_URL is not defined. Populate .env.local before running this script."
  );
  process.exit(1);
}

const client = postgres(process.env.POSTGRES_URL, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log("[analytics] loading completed runs…");

  const runRows = await db
    .select({
      runId: analysisRun.id,
      companyId: analysisRun.companyId,
      finalReportJson: analysisRun.finalReportJson,
      updatedAt: analysisRun.updatedAt,
      companySlug: company.slug,
      displayName: company.displayName,
      hqCountry: company.hqCountry,
      industry: company.industry,
    })
    .from(analysisRun)
    .innerJoin(company, eq(company.id, analysisRun.companyId))
    .where(
      and(
        eq(analysisRun.status, "completed"),
        isNotNull(analysisRun.finalReportJson)
      )
    )
    .orderBy(desc(analysisRun.createdAt));

  if (runRows.length === 0) {
    console.log("[analytics] no completed runs available; clearing snapshot");
    const payload = buildComparativeAnalytics([]);
    const now = new Date();
    try {
      await db
        .insert(analyticsSnapshot)
        .values({
          key: LANDING_ANALYTICS_SNAPSHOT_KEY,
          payload,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: analyticsSnapshot.key,
          set: {
            payload,
            updatedAt: now,
          },
        });
    } catch (error) {
      console.warn("[analytics] snapshot upsert skipped", error);
    }
    await client.end();
    return;
  }

  const seenCompanies = new Set<string>();
  const latestRuns = runRows.filter((row) => {
    if (seenCompanies.has(row.companyId)) {
      return false;
    }
    seenCompanies.add(row.companyId);
    return true;
  });

  const runContext = new Map<
    string,
    { displayName: string | null; companySlug: string | null }
  >();
  for (const row of latestRuns) {
    runContext.set(row.runId, {
      displayName: row.displayName,
      companySlug: row.companySlug,
    });
  }

  const runIds = latestRuns.map((row) => row.runId);
  const metricRows = runIds.length
    ? await db
        .select({
          runId: runMetric.runId,
          data: runMetric.data,
        })
        .from(runMetric)
        .where(
          and(
            eq(runMetric.metricType, "workforce_score"),
            inArray(runMetric.runId, runIds)
          )
        )
    : [];

  const metricMap = new Map<string, WorkforceImpactSnapshot | null>();
  for (const entry of metricRows) {
    const context = runContext.get(entry.runId);
    const parsed = parseWorkforceMetricData(entry.data, {
      companyName: context?.displayName ?? context?.companySlug ?? null,
      runId: entry.runId,
      source: "compute-analytics-snapshot",
    });
    metricMap.set(entry.runId, parsed);
  }

  const comparativeRuns: ComparativeRun[] = [];
  const parseFailures: string[] = [];

  for (const row of latestRuns) {
    if (!row.finalReportJson) {
      continue;
    }
    const parsed = enrichedOrgReportSchema.safeParse(row.finalReportJson);
    if (!parsed.success) {
      parseFailures.push(row.runId);
      continue;
    }

    let workforceMetric = metricMap.get(row.runId) ?? null;
    if (!workforceMetric) {
      const computed = computeWorkforceImpact(parsed.data);
      if (computed) {
        workforceMetric = {
          ...computed,
        };
      }
    }

    if (!workforceMetric) {
      // We still include the run to count coverage but it will be skipped
      // when aggregating averages.
      console.warn("[analytics] skipping run without workforce metric", {
        runId: row.runId,
        companyId: row.companyId,
      });
      continue;
    }

    comparativeRuns.push({
      runId: row.runId,
      companyId: row.companyId,
      companySlug: row.companySlug,
      displayName: row.displayName,
      hqCountry: row.hqCountry,
      industry: row.industry,
      workforceMetric,
      report: parsed.data,
    });
  }

  if (parseFailures.length > 0) {
    console.warn("[analytics] failed to parse reports for runs", parseFailures);
  }

  const payload = buildComparativeAnalytics(comparativeRuns);
  const now = new Date();

  const lowRunCountries = payload.countries
    .filter((entry) => entry.runCount <= 4)
    .sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });

  const lowRunIndustries = payload.industries
    .filter((entry) => entry.runCount <= 4)
    .sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });

  console.log("[analytics] low-sample countries (<=4 runs)", lowRunCountries);
  console.log("[analytics] low-sample industries (<=4 runs)", lowRunIndustries);

  try {
    await db
      .insert(analyticsSnapshot)
      .values({
        key: LANDING_ANALYTICS_SNAPSHOT_KEY,
        payload,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: analyticsSnapshot.key,
        set: {
          payload,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.warn("[analytics] snapshot upsert skipped", error);
  }

  console.log("[analytics] snapshot updated", {
    runs: comparativeRuns.length,
    countries: payload.countries.length,
    industries: payload.industries.length,
  });

  await client.end();
}

main().catch((error) => {
  console.error("[analytics] snapshot recompute failed", error);
  client.end();
  process.exit(1);
});
