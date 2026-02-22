import { NextResponse } from "next/server";

import { enrichedOrgReportSchema } from "@/lib/run/report-schema";
import { computeWorkforceImpact } from "@/lib/run/workforce-impact";
import { buildComparativeAnalytics } from "@/lib/run/comparative-analytics";
import { LANDING_ANALYTICS_SNAPSHOT_KEY } from "@/lib/constants/analytics";
import type { ComparativeRun } from "@/lib/run/comparative-analytics-types";
import {
  listCompletedRunsWithReports,
  listCompletedRunsWithCompany,
  replaceRunMetrics,
  upsertAnalyticsSnapshot,
} from "@/lib/db/queries";
import { runMetric } from "@/lib/db/schema";

type RunMetricInsert = typeof runMetric.$inferInsert;

function toPercentile(values: number[], target: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return 1;
  }
  const sorted = [...values].sort((a, b) => a - b);
  let rankIndex = -1;
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] <= target) {
      rankIndex = index;
    } else {
      break;
    }
  }
  if (rankIndex < 0) {
    return 0;
  }
  return rankIndex / (sorted.length - 1);
}

export async function POST() {
  const runs = await listCompletedRunsWithReports();

  const results = runs
    .map((entry) => {
      if (!entry.finalReportJson) return null;
      const parsed = enrichedOrgReportSchema.safeParse(entry.finalReportJson);
      if (!parsed.success) return null;

      const impact = computeWorkforceImpact(parsed.data);
      if (!impact) {
        return null;
      }

      return {
        runId: entry.runId,
        companyId: entry.companyId,
        updatedAt: entry.updatedAt,
        ...impact,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (results.length === 0) {
    await replaceRunMetrics("workforce_score", []);
    return NextResponse.json({
      processedRuns: runs.length,
      storedMetrics: 0,
      message: "No completed runs with computable impact data.",
    });
  }

  const overallScores = results.map((item) => item.score);
  const automationComponents = results.map((item) => item.automationComponent);
  const augmentationComponents = results.map((item) => item.augmentationComponent);

  const metrics: RunMetricInsert[] = results.map((item) => {
    const roundedAutomation = Number(item.automationComponent.toFixed(6));
    const roundedAugmentation = Number(item.augmentationComponent.toFixed(6));
    const percentileOverall = toPercentile(overallScores, item.score);
    const percentileAutomation = toPercentile(automationComponents, item.automationComponent);
    const percentileAugmentation = toPercentile(augmentationComponents, item.augmentationComponent);

    return {
      runId: item.runId,
      metricType: "workforce_score",
      label: "Workforce Impact Score",
      headcount: Math.round(item.totalHeadcount),
      automationShare: roundedAutomation.toString(),
      augmentationShare: roundedAugmentation.toString(),
      data: {
        score: item.score,
        totalHeadcount: item.totalHeadcount,
        automationImpact: item.automationImpact,
        augmentationImpact: item.augmentationImpact,
        coverageHeadcount: item.coverageHeadcount,
        components: {
          automation: item.automationComponent,
          augmentation: item.augmentationComponent,
          coverage: item.coverageComponent,
        },
        percentiles: {
          overall: percentileOverall,
          automation: percentileAutomation,
          augmentation: percentileAugmentation,
        },
        computedAt: new Date().toISOString(),
      },
    };
  });

  await replaceRunMetrics("workforce_score", metrics);

  // Build and store comparative analytics snapshot (with delta data)
  let comparativeStats = { runs: 0 };
  try {
    const runsWithCompany = await listCompletedRunsWithCompany();
    const impactByRun = new Map(results.map((r) => [r.runId, r]));

    const comparativeRuns: ComparativeRun[] = runsWithCompany
      .map((row): ComparativeRun | null => {
        if (!row.finalReportJson) return null;
        const parsed = enrichedOrgReportSchema.safeParse(row.finalReportJson);
        if (!parsed.success) return null;

        const impact = impactByRun.get(row.runId);

        return {
          runId: row.runId,
          companyId: row.companyId,
          companySlug: row.companySlug ?? null,
          displayName: row.displayName ?? null,
          hqCountry: row.hqCountry ?? null,
          industry: row.industry ?? null,
          workforceMetric: impact ?? null,
          report: parsed.data,
        };
      })
      .filter((r): r is ComparativeRun => r != null);

    if (comparativeRuns.length > 0) {
      const payload = buildComparativeAnalytics(comparativeRuns);
      await upsertAnalyticsSnapshot({
        key: LANDING_ANALYTICS_SNAPSHOT_KEY,
        payload,
      });
      comparativeStats = { runs: comparativeRuns.length };
    }
  } catch (err) {
    console.warn("[benchmark] comparative analytics generation failed", err);
  }

  return NextResponse.json({
    processedRuns: runs.length,
    storedMetrics: metrics.length,
    comparativeAnalytics: comparativeStats,
  });
}
