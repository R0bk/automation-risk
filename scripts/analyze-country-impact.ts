/**
 * analyze-country-impact.ts
 *
 * Estimates how v4 O*NET data changes affect countries by:
 *
 * 1. Loading the O*NET catalog to compute industry-level (parentCluster) deltas
 * 2. Loading the sp100-reports.ndjson to extract real company data with
 *    country, industry, headcount, and role-level O*NET breakdowns
 * 3. Cross-referencing: for each country, what is their industry mix
 *    (by headcount)? Weight the industry-level deltas by each country's
 *    industry composition to estimate country-level exposure deltas.
 * 4. Computing an industry exposure ranking: which O*NET clusters are most
 *    AI-affected under v4 vs v1, and how does the ranking change?
 *
 * Output: /tmp/country-impact-analysis.json + printed summary
 *
 * Usage: pnpm tsx scripts/analyze-country-impact.ts
 */

import { loadOnetCatalog, type OnetCatalogRole, type CatalogDelta } from "@/lib/onet/catalog";
import { COUNTRY_GROUP_ALIASES } from "@/lib/constants/aggregation-groups";
import { resolveIsoCode } from "@/lib/constants/countries";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoleWithDelta = OnetCatalogRole & {
  delta: NonNullable<OnetCatalogRole["delta"]>;
  prior: NonNullable<OnetCatalogRole["prior"]>;
};

/** Industry-level computed deltas from the O*NET catalog */
type IndustryDelta = {
  cluster: string;
  totalRoles: number;
  rolesWithDeltas: number;
  rolesChanged: number;
  // v1 baseline shares (as fraction of tasks)
  v1AutomationShare: number;
  v1AugmentationShare: number;
  v1ManualShare: number;
  // v4 current shares
  v4AutomationShare: number;
  v4AugmentationShare: number;
  v4ManualShare: number;
  // deltas (v4 - v1)
  automationShareDelta: number;
  augmentationShareDelta: number;
  manualShareDelta: number;
  // absolute change for ranking
  totalAbsShareDelta: number;
  // net AI exposure shift (automation + augmentation deltas combined)
  netAIExposureDelta: number;
  direction: string;
  // average per-role task-count deltas
  avgAutoTaskDelta: number;
  avgAugTaskDelta: number;
  avgManualTaskDelta: number;
  // workforce weight: how many total tasks exist in this cluster
  totalTaskCount: number;
  workforceWeight: number; // fraction of all catalog tasks
};

/** Country-industry cell from the company reports */
type CountryIndustryCell = {
  country: string;
  isoCode: string | null;
  cluster: string;
  headcount: number;
  companyCount: number;
  companies: string[];
};

/** Country-level computed exposure */
type CountryExposure = {
  country: string;
  isoCode: string | null;
  totalHeadcount: number;
  companyCount: number;
  industries: Array<{
    cluster: string;
    headcount: number;
    headcountShare: number;
    industryAutoShareDelta: number;
    industryAugShareDelta: number;
    industryManualShareDelta: number;
    industryNetAIDelta: number;
    weightedContribution: number; // headcountShare * industryNetAIDelta
  }>;
  // Weighted exposure deltas
  weightedAutoShareDelta: number;
  weightedAugShareDelta: number;
  weightedManualShareDelta: number;
  weightedNetAIExposureDelta: number;
  // Top industry exposures
  topPositiveIndustry: string | null;
  topNegativeIndustry: string | null;
  exposureDirection: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round4(v: number): number {
  return Number(v.toFixed(4));
}

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function sign(v: number): string {
  return v > 0 ? `+${v.toFixed(4)}` : v.toFixed(4);
}

function signPct(v: number): string {
  const pct = v * 100;
  return pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function normalizeCountryLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return COUNTRY_GROUP_ALIASES[trimmed] ?? trimmed;
}

// ---------------------------------------------------------------------------
// Step 1: Compute industry-level deltas from O*NET catalog
// ---------------------------------------------------------------------------

function computeIndustryDeltas(catalog: OnetCatalogRole[]): IndustryDelta[] {
  // Group by parentCluster
  const clusterMap = new Map<string, OnetCatalogRole[]>();
  for (const role of catalog) {
    const key = role.parentCluster ?? "(Uncategorized)";
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(role);
  }

  let globalTotalTasks = 0;
  const results: IndustryDelta[] = [];

  // First pass: count total tasks globally
  for (const role of catalog) {
    globalTotalTasks += role.metrics.taskCount;
  }

  for (const [cluster, roles] of clusterMap) {
    const rolesWithDeltas = roles.filter(
      (r): r is RoleWithDelta => r.delta != null && r.prior != null
    );

    const rolesChanged = rolesWithDeltas.filter(
      (r) =>
        r.delta.automationTasksDelta !== 0 ||
        r.delta.augmentationTasksDelta !== 0 ||
        r.delta.manualTasksDelta !== 0
    ).length;

    // Compute share-based metrics (more meaningful than raw task counts)
    // For each role, compute what fraction of its tasks are auto/aug/manual
    // Then average across the cluster

    let sumV1AutoShare = 0;
    let sumV1AugShare = 0;
    let sumV1ManualShare = 0;
    let sumV4AutoShare = 0;
    let sumV4AugShare = 0;
    let sumV4ManualShare = 0;
    let totalAutoTaskDelta = 0;
    let totalAugTaskDelta = 0;
    let totalManualTaskDelta = 0;
    let clusterTotalTasks = 0;
    let validRoleCount = 0;

    for (const role of rolesWithDeltas) {
      const tc = role.metrics.taskCount;
      if (tc === 0) continue;
      validRoleCount++;

      // v4 shares
      const v4Auto = role.metrics.automationTasks / tc;
      const v4Aug = role.metrics.augmentationTasks / tc;
      const v4Manual = role.metrics.manualTasks / tc;

      // v1 shares: compute from prior data
      const priorTotal =
        role.prior.automationTasks +
        role.prior.augmentationTasks +
        role.prior.manualTasks;
      const v1Auto = priorTotal > 0 ? role.prior.automationTasks / priorTotal : 0;
      const v1Aug = priorTotal > 0 ? role.prior.augmentationTasks / priorTotal : 0;
      const v1Manual = priorTotal > 0 ? role.prior.manualTasks / priorTotal : 0;

      sumV4AutoShare += v4Auto;
      sumV4AugShare += v4Aug;
      sumV4ManualShare += v4Manual;
      sumV1AutoShare += v1Auto;
      sumV1AugShare += v1Aug;
      sumV1ManualShare += v1Manual;

      totalAutoTaskDelta += role.delta.automationTasksDelta;
      totalAugTaskDelta += role.delta.augmentationTasksDelta;
      totalManualTaskDelta += role.delta.manualTasksDelta;
      clusterTotalTasks += tc;
    }

    // Also include roles WITHOUT deltas in task count for workforce weight
    for (const role of roles) {
      if (role.delta == null || role.prior == null) {
        clusterTotalTasks += role.metrics.taskCount;
      }
    }

    const n = validRoleCount || 1;
    const v1AutoShare = round4(sumV1AutoShare / n);
    const v1AugShare = round4(sumV1AugShare / n);
    const v1ManualShare = round4(sumV1ManualShare / n);
    const v4AutoShare = round4(sumV4AutoShare / n);
    const v4AugShare = round4(sumV4AugShare / n);
    const v4ManualShare = round4(sumV4ManualShare / n);

    const autoShareDelta = round4(v4AutoShare - v1AutoShare);
    const augShareDelta = round4(v4AugShare - v1AugShare);
    const manualShareDelta = round4(v4ManualShare - v1ManualShare);
    const totalAbsShareDelta = round4(
      Math.abs(autoShareDelta) + Math.abs(augShareDelta) + Math.abs(manualShareDelta)
    );
    const netAIExposureDelta = round4(autoShareDelta + augShareDelta);

    let direction: string;
    if (netAIExposureDelta > 0.005) direction = "INCREASING AI exposure";
    else if (netAIExposureDelta < -0.005) direction = "DECREASING AI exposure";
    else direction = "STABLE";

    results.push({
      cluster,
      totalRoles: roles.length,
      rolesWithDeltas: rolesWithDeltas.length,
      rolesChanged,
      v1AutomationShare: v1AutoShare,
      v1AugmentationShare: v1AugShare,
      v1ManualShare: v1ManualShare,
      v4AutomationShare: v4AutoShare,
      v4AugmentationShare: v4AugShare,
      v4ManualShare: v4ManualShare,
      automationShareDelta: autoShareDelta,
      augmentationShareDelta: augShareDelta,
      manualShareDelta: manualShareDelta,
      totalAbsShareDelta,
      netAIExposureDelta,
      direction,
      avgAutoTaskDelta: round4(totalAutoTaskDelta / n),
      avgAugTaskDelta: round4(totalAugTaskDelta / n),
      avgManualTaskDelta: round4(totalManualTaskDelta / n),
      totalTaskCount: clusterTotalTasks,
      workforceWeight: globalTotalTasks > 0 ? round4(clusterTotalTasks / globalTotalTasks) : 0,
    });
  }

  // Sort by absolute share delta (biggest movers first)
  results.sort((a, b) => b.totalAbsShareDelta - a.totalAbsShareDelta);
  return results;
}

// ---------------------------------------------------------------------------
// Step 2: Load sp100 reports for country-industry cross-tabs
// ---------------------------------------------------------------------------

type CompanyReportEntry = {
  ticker: string;
  slug: string;
  companyName: string;
  hqCountry: string;
  headcount: number;
  roles: Array<{
    onetCode: string;
    parentCluster: string | null;
    headcount: number;
  }>;
};

function loadCompanyReports(): CompanyReportEntry[] {
  const filePath = join(process.cwd(), "saved", "sp100-reports.ndjson");
  let rawContent: string;
  try {
    rawContent = readFileSync(filePath, "utf-8");
  } catch {
    console.warn("  [WARN] Could not load sp100-reports.ndjson - will use catalog-only approach");
    return [];
  }

  const entries: CompanyReportEntry[] = [];
  const lines = rawContent.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line);
      const report = d?.report;
      if (!report?.metadata) continue;

      const meta = report.metadata;
      const rawCountry = normalizeCountryLabel(meta.hqCountry);
      if (!rawCountry) continue;

      const totalHeadcount = meta.workforceEstimate ?? 0;
      const roles = (report.roles ?? []).map((r: any) => ({
        onetCode: r.onetCode ?? "",
        parentCluster: r.parentCluster ?? null,
        headcount: r.headcount ?? 0,
      }));

      entries.push({
        ticker: d.ticker ?? "",
        slug: d.slug ?? "",
        companyName: meta.companyName ?? d.companyName ?? "",
        hqCountry: rawCountry,
        headcount: totalHeadcount,
        roles,
      });
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Step 3: Build country-industry cross-tabs from company reports
// ---------------------------------------------------------------------------

function buildCountryIndustryCrossTabs(
  reports: CompanyReportEntry[]
): Map<string, CountryIndustryCell[]> {
  // For each company, distribute headcount across O*NET clusters based on role headcounts
  const cellMap = new Map<string, CountryIndustryCell>();

  for (const report of reports) {
    const country = report.hqCountry;
    const isoCode = resolveIsoCode(country);

    // Aggregate role headcounts by parentCluster
    const clusterHeadcounts = new Map<string, number>();
    let assignedHeadcount = 0;

    for (const role of report.roles) {
      if (!role.parentCluster || role.headcount <= 0) continue;
      const existing = clusterHeadcounts.get(role.parentCluster) ?? 0;
      clusterHeadcounts.set(role.parentCluster, existing + role.headcount);
      assignedHeadcount += role.headcount;
    }

    // If roles don't account for all headcount, the remainder is unassigned
    // We only count what's assigned to known clusters

    for (const [cluster, hc] of clusterHeadcounts) {
      const key = `${country}::${cluster}`;
      let cell = cellMap.get(key);
      if (!cell) {
        cell = {
          country,
          isoCode,
          cluster,
          headcount: 0,
          companyCount: 0,
          companies: [],
        };
        cellMap.set(key, cell);
      }
      cell.headcount += hc;
      cell.companyCount += 1;
      if (cell.companies.length < 5) {
        cell.companies.push(report.companyName);
      }
    }
  }

  // Group by country
  const countryMap = new Map<string, CountryIndustryCell[]>();
  for (const cell of cellMap.values()) {
    if (!countryMap.has(cell.country)) countryMap.set(cell.country, []);
    countryMap.get(cell.country)!.push(cell);
  }

  return countryMap;
}

// ---------------------------------------------------------------------------
// Step 4: Cross-reference industry deltas with country compositions
// ---------------------------------------------------------------------------

function computeCountryExposures(
  countryIndustryMap: Map<string, CountryIndustryCell[]>,
  industryDeltas: IndustryDelta[],
  reports: CompanyReportEntry[]
): CountryExposure[] {
  const deltaLookup = new Map<string, IndustryDelta>();
  for (const d of industryDeltas) {
    deltaLookup.set(d.cluster, d);
  }

  // Count companies per country
  const companyCountByCountry = new Map<string, Set<string>>();
  for (const r of reports) {
    if (!companyCountByCountry.has(r.hqCountry)) {
      companyCountByCountry.set(r.hqCountry, new Set());
    }
    companyCountByCountry.get(r.hqCountry)!.add(r.slug || r.ticker);
  }

  const exposures: CountryExposure[] = [];

  for (const [country, cells] of countryIndustryMap) {
    const isoCode = resolveIsoCode(country);
    const totalHeadcount = cells.reduce((s, c) => s + c.headcount, 0);
    if (totalHeadcount === 0) continue;

    let weightedAutoDelta = 0;
    let weightedAugDelta = 0;
    let weightedManualDelta = 0;

    const industryBreakdown: CountryExposure["industries"] = [];

    for (const cell of cells) {
      const share = cell.headcount / totalHeadcount;
      const delta = deltaLookup.get(cell.cluster);

      const autoD = delta?.automationShareDelta ?? 0;
      const augD = delta?.augmentationShareDelta ?? 0;
      const manualD = delta?.manualShareDelta ?? 0;
      const netAID = autoD + augD;

      weightedAutoDelta += share * autoD;
      weightedAugDelta += share * augD;
      weightedManualDelta += share * manualD;

      industryBreakdown.push({
        cluster: cell.cluster,
        headcount: cell.headcount,
        headcountShare: round4(share),
        industryAutoShareDelta: autoD,
        industryAugShareDelta: augD,
        industryManualShareDelta: manualD,
        industryNetAIDelta: round4(netAID),
        weightedContribution: round4(share * netAID),
      });
    }

    // Sort industries by headcount share descending
    industryBreakdown.sort((a, b) => b.headcountShare - a.headcountShare);

    // Find top positive and negative contributors
    const sorted = [...industryBreakdown].sort(
      (a, b) => b.weightedContribution - a.weightedContribution
    );
    const topPositive = sorted.find((i) => i.weightedContribution > 0);
    const topNegative = [...sorted].reverse().find((i) => i.weightedContribution < 0);

    const netExposure = round4(weightedAutoDelta + weightedAugDelta);
    let exposureDirection: string;
    if (netExposure > 0.002) exposureDirection = "INCREASING AI exposure";
    else if (netExposure < -0.002) exposureDirection = "DECREASING AI exposure";
    else exposureDirection = "STABLE";

    exposures.push({
      country,
      isoCode,
      totalHeadcount,
      companyCount: companyCountByCountry.get(country)?.size ?? 0,
      industries: industryBreakdown,
      weightedAutoShareDelta: round4(weightedAutoDelta),
      weightedAugShareDelta: round4(weightedAugDelta),
      weightedManualShareDelta: round4(weightedManualDelta),
      weightedNetAIExposureDelta: netExposure,
      topPositiveIndustry: topPositive?.cluster ?? null,
      topNegativeIndustry: topNegative?.cluster ?? null,
      exposureDirection,
    });
  }

  // Sort by absolute net exposure delta (most affected first)
  exposures.sort(
    (a, b) =>
      Math.abs(b.weightedNetAIExposureDelta) -
      Math.abs(a.weightedNetAIExposureDelta)
  );

  return exposures;
}

// ---------------------------------------------------------------------------
// Step 5: Industry ranking comparison (v1 vs v4)
// ---------------------------------------------------------------------------

type IndustryRankEntry = {
  cluster: string;
  v1AIExposure: number; // fraction of tasks that are auto+aug under v1
  v4AIExposure: number; // fraction of tasks that are auto+aug under v4
  v1Rank: number;
  v4Rank: number;
  rankChange: number; // positive = moved up (more exposed relative to others)
  exposureDelta: number;
};

function computeIndustryRanking(industryDeltas: IndustryDelta[]): IndustryRankEntry[] {
  // Compute v1 and v4 AI exposure for each cluster
  const entries = industryDeltas.map((d) => ({
    cluster: d.cluster,
    v1AIExposure: round4(d.v1AutomationShare + d.v1AugmentationShare),
    v4AIExposure: round4(d.v4AutomationShare + d.v4AugmentationShare),
    exposureDelta: round4(d.netAIExposureDelta),
  }));

  // Rank by v1 exposure (1 = most exposed)
  const byV1 = [...entries].sort((a, b) => b.v1AIExposure - a.v1AIExposure);
  const v1Ranks = new Map<string, number>();
  byV1.forEach((e, i) => v1Ranks.set(e.cluster, i + 1));

  // Rank by v4 exposure
  const byV4 = [...entries].sort((a, b) => b.v4AIExposure - a.v4AIExposure);
  const v4Ranks = new Map<string, number>();
  byV4.forEach((e, i) => v4Ranks.set(e.cluster, i + 1));

  const result: IndustryRankEntry[] = entries.map((e) => {
    const v1Rank = v1Ranks.get(e.cluster) ?? 0;
    const v4Rank = v4Ranks.get(e.cluster) ?? 0;
    return {
      ...e,
      v1Rank,
      v4Rank,
      rankChange: v1Rank - v4Rank, // positive = moved up in AI exposure
    };
  });

  // Sort by v4 rank
  result.sort((a, b) => a.v4Rank - b.v4Rank);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("=".repeat(120));
  console.log("  COUNTRY IMPACT ANALYSIS: How v4 O*NET Changes Affect Countries");
  console.log("=".repeat(120));
  console.log();

  // Step 1: Load catalog and compute industry deltas
  console.log("[1/5] Loading O*NET catalog...");
  const catalog = loadOnetCatalog();
  console.log(`  Loaded ${catalog.length} roles from O*NET catalog.`);
  console.log();

  console.log("[2/5] Computing industry-level deltas...");
  const industryDeltas = computeIndustryDeltas(catalog);
  console.log(`  Computed deltas for ${industryDeltas.length} industry clusters.`);
  console.log();

  // Step 2: Load company reports
  console.log("[3/5] Loading company reports from sp100-reports.ndjson...");
  const reports = loadCompanyReports();
  console.log(`  Loaded ${reports.length} company reports.`);

  if (reports.length === 0) {
    console.log("  [WARN] No company reports available. Falling back to catalog-only analysis.");
    console.log("  We will still produce industry-level deltas and rankings.");
  }
  console.log();

  // Step 3: Build country-industry cross-tabs
  console.log("[4/5] Building country-industry cross-tabs...");
  const countryIndustryMap = buildCountryIndustryCrossTabs(reports);
  console.log(`  Found ${countryIndustryMap.size} countries with industry data.`);
  console.log();

  // Step 4: Compute country exposures
  console.log("[5/5] Computing country-level exposure deltas...");
  const countryExposures = computeCountryExposures(
    countryIndustryMap,
    industryDeltas,
    reports
  );
  console.log(`  Computed exposure for ${countryExposures.length} countries.`);
  console.log();

  // Step 5: Industry ranking comparison
  const industryRanking = computeIndustryRanking(industryDeltas);

  // =========================================================================
  // OUTPUT: JSON
  // =========================================================================

  const output = {
    generatedAt: new Date().toISOString(),
    methodology: {
      description:
        "Cross-references O*NET v1->v4 industry-level task classification deltas with " +
        "company workforce composition data from sp100-reports.ndjson. For each country, " +
        "the industry mix (by headcount) is used to weight-average the industry-level AI " +
        "exposure shifts, producing an estimated country-level impact of the v4 reclassification.",
      dataVintages: {
        v1: "January 2025 (onetData.json / onetData-v1-2025-01.json)",
        v4: "November 2025 (onetData-v4-2025-11.json)",
      },
      caveats: [
        "Country exposure is estimated from SP100-equivalent company HQ locations, not full national workforce data.",
        "Industry mix is based on company role headcounts mapped to O*NET parentCluster, not official GDP/employment stats.",
        "Share deltas represent reclassification changes in task categorization, not necessarily real-world automation adoption.",
        "Countries with fewer companies in the dataset have higher estimation uncertainty.",
      ],
    },
    summary: {
      totalCatalogRoles: catalog.length,
      industryClusters: industryDeltas.length,
      companiesAnalyzed: reports.length,
      countriesCovered: countryExposures.length,
      topCountryByExposureIncrease: countryExposures.find(
        (c) => c.weightedNetAIExposureDelta > 0
      )?.country ?? null,
      topCountryByExposureDecrease: countryExposures.find(
        (c) => c.weightedNetAIExposureDelta < 0
      )?.country ?? null,
    },
    industryDeltas,
    industryRanking,
    countryExposures,
    countryIndustryCrossTabs: Array.from(countryIndustryMap.entries()).map(
      ([country, cells]) => ({
        country,
        isoCode: resolveIsoCode(country),
        totalHeadcount: cells.reduce((s, c) => s + c.headcount, 0),
        clusterCount: cells.length,
        topClusters: cells
          .sort((a, b) => b.headcount - a.headcount)
          .slice(0, 10)
          .map((c) => ({
            cluster: c.cluster,
            headcount: c.headcount,
            companyCount: c.companyCount,
            companies: c.companies,
          })),
      })
    ),
  };

  writeFileSync(
    "/tmp/country-impact-analysis.json",
    JSON.stringify(output, null, 2),
    "utf-8"
  );
  console.log("JSON output written to /tmp/country-impact-analysis.json");
  console.log();

  // =========================================================================
  // PRINT: Industry Deltas Summary
  // =========================================================================

  console.log("=".repeat(120));
  console.log("  SECTION A: INDUSTRY-LEVEL AI EXPOSURE DELTAS (v1 -> v4)");
  console.log("  Sorted by total absolute share change");
  console.log("=".repeat(120));
  console.log();

  const hdr1 = [
    padRight("#", 3),
    padRight("Industry Cluster", 44),
    padLeft("Roles", 5),
    padLeft("v1 AI%", 8),
    padLeft("v4 AI%", 8),
    padLeft("Delta", 9),
    padLeft("Auto D", 9),
    padLeft("Aug D", 9),
    padLeft("Wt%", 6),
    padRight("  Direction", 26),
  ].join(" ");

  console.log(hdr1);
  console.log("-".repeat(120));

  for (let i = 0; i < industryDeltas.length; i++) {
    const d = industryDeltas[i];
    const v1AI = (d.v1AutomationShare + d.v1AugmentationShare) * 100;
    const v4AI = (d.v4AutomationShare + d.v4AugmentationShare) * 100;
    const row = [
      padRight(String(i + 1), 3),
      padRight(d.cluster.slice(0, 44), 44),
      padLeft(String(d.rolesWithDeltas), 5),
      padLeft(v1AI.toFixed(1) + "%", 8),
      padLeft(v4AI.toFixed(1) + "%", 8),
      padLeft(signPct(d.netAIExposureDelta), 9),
      padLeft(signPct(d.automationShareDelta), 9),
      padLeft(signPct(d.augmentationShareDelta), 9),
      padLeft((d.workforceWeight * 100).toFixed(1) + "%", 6),
      "  " + d.direction,
    ].join(" ");
    console.log(row);
  }
  console.log("-".repeat(120));
  console.log();

  // =========================================================================
  // PRINT: Industry Ranking Change
  // =========================================================================

  console.log("=".repeat(120));
  console.log("  SECTION B: INDUSTRY AI EXPOSURE RANKING (v1 vs v4)");
  console.log("  Rank 1 = most AI-exposed. Positive rank change = moved up (more exposed).");
  console.log("=".repeat(120));
  console.log();

  const hdr2 = [
    padRight("v4#", 4),
    padRight("Industry Cluster", 44),
    padLeft("v1 AI%", 8),
    padLeft("v4 AI%", 8),
    padLeft("v1 Rank", 8),
    padLeft("v4 Rank", 8),
    padLeft("Change", 8),
    padRight("  Movement", 20),
  ].join(" ");

  console.log(hdr2);
  console.log("-".repeat(120));

  for (const r of industryRanking) {
    const v1AI = r.v1AIExposure * 100;
    const v4AI = r.v4AIExposure * 100;
    let movement = "";
    if (r.rankChange > 0) movement = `UP ${r.rankChange}`;
    else if (r.rankChange < 0) movement = `DOWN ${Math.abs(r.rankChange)}`;
    else movement = "---";

    const row = [
      padRight(String(r.v4Rank), 4),
      padRight(r.cluster.slice(0, 44), 44),
      padLeft(v1AI.toFixed(1) + "%", 8),
      padLeft(v4AI.toFixed(1) + "%", 8),
      padLeft(String(r.v1Rank), 8),
      padLeft(String(r.v4Rank), 8),
      padLeft(r.rankChange > 0 ? `+${r.rankChange}` : String(r.rankChange), 8),
      "  " + movement,
    ].join(" ");
    console.log(row);
  }
  console.log("-".repeat(120));
  console.log();

  // =========================================================================
  // PRINT: Country Exposure Summary
  // =========================================================================

  if (countryExposures.length > 0) {
    console.log("=".repeat(120));
    console.log("  SECTION C: COUNTRY-LEVEL EXPOSURE DELTAS");
    console.log("  Weighted by each country's industry composition (headcount-based).");
    console.log("  Interpretation: if a country's workforce is concentrated in industries");
    console.log("  that saw large v4 reclassifications, the country has higher exposure delta.");
    console.log("=".repeat(120));
    console.log();

    const hdr3 = [
      padRight("#", 3),
      padRight("Country", 26),
      padLeft("ISO", 4),
      padLeft("Cos", 4),
      padLeft("HC", 10),
      padLeft("Net AI D", 10),
      padLeft("Auto D", 10),
      padLeft("Aug D", 10),
      padRight("  Top+ Industry", 30),
      padRight("  Direction", 24),
    ].join(" ");

    console.log(hdr3);
    console.log("-".repeat(140));

    for (let i = 0; i < countryExposures.length; i++) {
      const c = countryExposures[i];
      const row = [
        padRight(String(i + 1), 3),
        padRight(c.country.slice(0, 26), 26),
        padLeft(c.isoCode ?? "??", 4),
        padLeft(String(c.companyCount), 4),
        padLeft(c.totalHeadcount.toLocaleString(), 10),
        padLeft(signPct(c.weightedNetAIExposureDelta), 10),
        padLeft(signPct(c.weightedAutoShareDelta), 10),
        padLeft(signPct(c.weightedAugShareDelta), 10),
        "  " + padRight((c.topPositiveIndustry ?? "N/A").slice(0, 28), 28),
        "  " + c.exposureDirection,
      ].join(" ");
      console.log(row);
    }
    console.log("-".repeat(140));
    console.log();

    // =========================================================================
    // PRINT: Detailed country breakdowns (top 10)
    // =========================================================================

    console.log("=".repeat(120));
    console.log("  SECTION D: DETAILED COUNTRY BREAKDOWNS (top 10 by absolute exposure delta)");
    console.log("=".repeat(120));

    for (let i = 0; i < Math.min(10, countryExposures.length); i++) {
      const c = countryExposures[i];
      console.log();
      console.log(`  ${i + 1}. ${c.country} (${c.isoCode ?? "??"})  --  ${c.exposureDirection}`);
      console.log(`     Companies: ${c.companyCount}  |  Total headcount: ${c.totalHeadcount.toLocaleString()}`);
      console.log(
        `     Weighted deltas:  Auto ${signPct(c.weightedAutoShareDelta)}  |  Aug ${signPct(c.weightedAugShareDelta)}  |  Manual ${signPct(c.weightedManualShareDelta)}  |  Net AI ${signPct(c.weightedNetAIExposureDelta)}`
      );
      console.log(`     Industry mix (by headcount):`);

      for (const ind of c.industries.slice(0, 8)) {
        const pctStr = (ind.headcountShare * 100).toFixed(1);
        console.log(
          `       - ${padRight(ind.cluster.slice(0, 40), 40)}  ${padLeft(pctStr + "%", 6)} of HC  |  Ind AI delta: ${signPct(ind.industryNetAIDelta)}  |  Contribution: ${signPct(ind.weightedContribution)}`
        );
      }
      if (c.industries.length > 8) {
        console.log(`       ... and ${c.industries.length - 8} more clusters`);
      }
    }
  } else {
    console.log("  [INFO] No country exposure data available (no company reports loaded).");
    console.log("  The industry-level deltas (Sections A and B above) are still valid.");
  }

  console.log();
  console.log("=".repeat(120));
  console.log("  ANALYSIS COMPLETE");
  console.log("  Full JSON output: /tmp/country-impact-analysis.json");
  console.log("=".repeat(120));
}

main();
