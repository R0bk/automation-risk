"use client";

import { Info } from "lucide-react";
import type { EnrichedOrgReport } from "@/lib/run/report-schema";
import {
  collectAggregationImpacts,
  collectRoleImpacts,
  type AggregationImpact,
  type RoleImpact,
  type WorkforceImpactSnapshot,
} from "@/lib/run/workforce-impact";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskMixSelector } from "./TaskMixSelector";
import { OrgFlowChart } from "./OrgFlowChart";

interface ReportPreviewProps {
  report: EnrichedOrgReport;
  impact?: WorkforceImpactSnapshot | null;
}

type HighlightCard = {
  title: string;
  label: string;
  detail: string;
  footnote?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const MIN_HEADCOUNT_FOR_HIGHLIGHT = 50;

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
};

const computeManualShare = (automation: number | null | undefined, augmentation: number | null | undefined) => {
  if (automation == null && augmentation == null) return null;
  const total = (automation ?? 0) + (augmentation ?? 0);
  return Math.max(0, 1 - total);
};

const buildHighlightFromBucket = (title: string, bucket: AggregationImpact | null): HighlightCard | null => {
  if (!bucket) return null;
  return {
    title,
    label: bucket.label,
    detail: `${bucket.groupLabel} • ${numberFormatter.format(bucket.headcount)} people`,
    footnote: `Auto ${formatPercent(bucket.automationShare)} · Aug ${formatPercent(bucket.augmentationShare)}`,
  };
};

const buildFallbackHighlight = (
  title: string,
  impact: WorkforceImpactSnapshot | null | undefined,
  label: string,
  footnoteBuilder: (impact: WorkforceImpactSnapshot | null | undefined) => string
): HighlightCard => {
  return {
    title,
    label,
    detail:
      impact?.totalHeadcount != null
        ? `${numberFormatter.format(Math.round(impact.totalHeadcount))} people covered`
        : "Awaiting aggregation coverage",
    footnote: footnoteBuilder(impact),
  };
};

const toSortedRows = (rows: AggregationImpact[], limit: number) =>
  rows
    .slice()
    .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))
    .slice(0, limit);

const renderImpactTable = (title: string, rows: AggregationImpact[]) => {
  if (rows.length === 0) return null;
  return (
    <div
      key={title}
      className="rounded-3xl border border-[rgba(38,37,30,0.1)] px-5 py-5 shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
      style={{
        backgroundImage: "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
      }}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
        {title}
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed text-xs text-[rgba(38,37,30,0.75)]">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[rgba(38,37,30,0.48)]">
            <tr>
              <th className="w-[44%] pb-1 text-left font-semibold">Segment</th>
              <th className="w-[22%] pb-1 text-right font-semibold">Headcount</th>
              <th className="w-[17%] pb-1 text-right font-semibold">Auto</th>
              <th className="w-[17%] pb-1 text-right font-semibold">Aug</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(38,37,30,0.08)]">
            {rows.map((row) => (
              <tr key={`${row.type}-${row.label}`}>
                <td className="py-2 pr-3 align-middle">
                  <div className="flex items-center gap-2">
                    {row.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex max-w-full cursor-help items-center gap-1 text-left text-[#26251e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cf2d56]/60"
                          >
                            <span className="truncate font-semibold">{row.label}</span>
                            <Info className="h-3 w-3 shrink-0 text-[rgba(38,37,30,0.45)]" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
                          {row.notes}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="truncate font-semibold text-[#26251e]">{row.label}</span>
                    )}
                  </div>
                </td>
                <td className="py-2 text-right font-mono text-[rgba(38,37,30,0.75)]">
                  {numberFormatter.format(row.headcount)}
                </td>
                <td className="py-2 text-right font-mono text-[#cf2d56]">
                  {formatPercent(row.automationShare)}
                </td>
                <td className="py-2 text-right font-mono text-[#2d6fce]">
                  {formatPercent(row.augmentationShare)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const renderRoleCard = (role: RoleImpact) => {
  const topNode = role.nodes[0];
  const manualShare = computeManualShare(role.automationShare, role.augmentationShare);
  return (
    <li
      key={role.onetCode}
      className="rounded-3xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.66)] px-4 py-5 shadow-[0_14px_32px_rgba(34,28,20,0.12)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[#26251e]">{role.title}</div>
          <div className="text-xs text-[rgba(38,37,30,0.5)]">{role.onetCode}</div>
        </div>
        <div className="text-right font-mono text-sm text-[#26251e]">
          {numberFormatter.format(role.headcount)} mapped
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgba(38,37,30,0.65)]">
        <span>{numberFormatter.format(role.headcount)} mapped headcount</span>
        <span className="text-[#cf2d56]">Auto {formatPercent(role.automationShare)}</span>
        <span className="text-[#2d6fce]">Aug {formatPercent(role.augmentationShare)}</span>
        <span className="text-[rgba(38,37,30,0.6)]">Manual {formatPercent(manualShare)}</span>
      </div>
      {topNode && (
        <div className="mt-2 text-xs text-[rgba(38,37,30,0.6)]">
          Largest placement: {topNode.nodeName} • {numberFormatter.format(topNode.headcount)} people
        </div>
      )}
    </li>
  );
};

export function ReportPreview({ report, impact }: ReportPreviewProps) {
  const aggregationImpacts = collectAggregationImpacts(report);
  const roleImpacts = collectRoleImpacts(report);

  const sizableImpacts = aggregationImpacts.filter((item) => item.headcount >= MIN_HEADCOUNT_FOR_HIGHLIGHT);
  const baseHighlights = sizableImpacts.length > 0 ? sizableImpacts : aggregationImpacts;

  const biggestExposureBucket =
    baseHighlights
      .filter((item) => item.impact != null)
      .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))[0] ?? null;

  const augmentationBucket =
    baseHighlights
      .filter((item) => item.augmentationShare != null)
      .sort((a, b) => {
        const diff = (b.augmentationShare ?? 0) - (a.augmentationShare ?? 0);
        if (diff !== 0) return diff;
        return b.headcount - a.headcount;
      })[0] ?? null;

  const capacityBucket =
    baseHighlights
      .map((item) => ({
        ...item,
        manualShare: computeManualShare(item.automationShare, item.augmentationShare),
      }))
      .filter((item) => item.manualShare != null)
      .sort((a, b) => {
        const diff = (b.manualShare ?? 0) - (a.manualShare ?? 0);
        if (diff !== 0) return diff;
        return b.headcount - a.headcount;
      })[0] ?? null;

  const highlightCards: HighlightCard[] = [];

  highlightCards.push(
    buildHighlightFromBucket("Biggest Exposure", biggestExposureBucket) ??
      buildFallbackHighlight(
        "Biggest Exposure",
        impact,
        "Company-wide exposure",
        (snapshot) =>
          `Auto ${formatPercent(snapshot?.automationComponent)} · Aug ${formatPercent(snapshot?.augmentationComponent)}`
      )
  );

  highlightCards.push(
    buildHighlightFromBucket("Augmentation Lift", augmentationBucket) ??
      buildFallbackHighlight(
        "Augmentation Lift",
        impact,
        "Augmentation readiness",
        (snapshot) => `Aug ${formatPercent(snapshot?.augmentationComponent)} across mapped workforce`
      )
  );

  highlightCards.push(
    buildHighlightFromBucket("Manual Load", capacityBucket) ??
      buildFallbackHighlight(
        "Manual Load",
        impact,
        "Manual workload pockets",
        (snapshot) => {
          const manualShare = computeManualShare(
            snapshot?.automationComponent ?? null,
            snapshot?.augmentationComponent ?? null
          );
          return `Manual ${formatPercent(manualShare)} across mapped roles`;
        }
      )
  );

  const functionRows = aggregationImpacts.filter((item) => item.type === "function");
  const geographyRows = aggregationImpacts.filter((item) => item.type === "geography");
  const seniorityRows = aggregationImpacts.filter((item) => item.type === "seniority");
  const businessRows = aggregationImpacts.filter((item) => item.type === "business_unit");

  const tables = [
    functionRows.length > 0
      ? {
          key: "function",
          title: functionRows[0]?.groupLabel ?? "Functional impact",
          rows: toSortedRows(functionRows, 6),
        }
      : null,
    geographyRows.length > 0
      ? {
          key: "geography",
          title: geographyRows[0]?.groupLabel ?? "Geographic footprint",
          rows: toSortedRows(geographyRows, 6),
        }
      : null,
    seniorityRows.length > 0
      ? {
          key: "seniority",
          title: seniorityRows[0]?.groupLabel ?? "Seniority mix",
          rows: toSortedRows(seniorityRows, 6),
        }
      : null,
    businessRows.length > 0
      ? {
          key: "business_unit",
          title: businessRows[0]?.groupLabel ?? "Business unit alignment",
          rows: toSortedRows(businessRows, 6),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; title: string; rows: AggregationImpact[] }>;

const roleSpotlight = roleImpacts
    .filter((role) => role.headcount > 0)
    .sort((a, b) => {
      const impactDiff = (b.impact ?? 0) - (a.impact ?? 0);
      if (impactDiff !== 0) return impactDiff;
      return b.headcount - a.headcount;
    })
    .slice(0, 3);

  const manualShareOverall = computeManualShare(
    impact?.automationComponent ?? null,
    impact?.augmentationComponent ?? null
  );

  return (
    <TooltipProvider delayDuration={120}>
      <section
      className="overflow-visible rounded-[32px] border border-[rgba(38,37,30,0.1)] px-4 py-7 shadow-[0_26px_65px_rgba(34,28,20,0.14)] backdrop-blur-[18px] sm:px-6"
      style={{
        backgroundImage: "linear-gradient(150deg, rgba(244,243,239,0.95), rgba(236,234,228,0.9))",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#26251e]">Workforce impact breakdown</h2>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Finalized via org_report_finalizer
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <TaskMixSelector />
          {report.metadata.sources.length > 0 && (
            <span className="text-xs text-[rgba(38,37,30,0.55)]">
              {report.metadata.sources.length} cited sources
            </span>
          )}
        </div>
      </div>

      {report.metadata.summary && (
        <p className="mt-5 text-sm leading-relaxed text-[rgba(38,37,30,0.7)]">
          {report.metadata.summary}
        </p>
      )}

      <div
        id="org-chart"
        className="mt-7 w-full lg:-mx-[calc((100vw-100%)/2)] lg:w-screen"
      >
        <div
          className="overflow-hidden rounded-[32px] border border-[rgba(38,37,30,0.1)] bg-[rgba(244,243,239,0.96)] shadow-[0_26px_65px_rgba(34,28,20,0.14)] backdrop-blur-[18px] 
          w-full
          lg:mx-auto lg:w-[min(100vw-4rem,1600px)] lg:max-w-[1600px] xl:w-[min(100vw-6rem,1800px)] xl:max-w-[1800px]"
        >
          <OrgFlowChart report={report} />
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {highlightCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] px-5 py-5 shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.55)]">
              {card.title}
            </p>
            <div className="mt-3 text-base font-semibold text-[#26251e]">{card.label}</div>
            <div className="mt-1 text-xs text-[rgba(38,37,30,0.6)]">{card.detail}</div>
            {card.footnote && (
              <div className="mt-3 text-xs font-mono text-[rgba(38,37,30,0.72)]">{card.footnote}</div>
            )}
          </div>
        ))}
      </div>

      {tables.length > 0 && (
        <div className={`mt-6 grid gap-5 ${tables.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {tables.map((table) => renderImpactTable(table.title, table.rows))}
        </div>
      )}

      {roleSpotlight.length > 0 && (
        <div
          className="mt-6 rounded-3xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.72)] px-5 py-6 shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
          style={{
            backgroundImage: "linear-gradient(150deg, rgba(245,244,238,0.95), rgba(235,233,226,0.9))",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
              Role spotlight
            </h3>
            <div className="text-xs text-[rgba(38,37,30,0.6)]">
              Manual load {formatPercent(manualShareOverall)}
            </div>
          </div>
          <ul className="mt-4 space-y-4 text-sm">{roleSpotlight.map((role) => renderRoleCard(role))}</ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[rgba(38,37,30,0.55)]">
        <div className="space-x-2">
          {report.metadata.workforceEstimate != null && (
            <span>
              Workforce estimate: {numberFormatter.format(report.metadata.workforceEstimate)}
            </span>
          )}
          <span>Last updated {new Date(report.metadata.lastUpdatedIso).toLocaleString()}</span>
        </div>
        {impact?.computedAt && (
          <span>Benchmark refreshed {new Date(impact.computedAt).toLocaleString()}</span>
        )}
      </div>
    </section>
    </TooltipProvider>
  );
}
