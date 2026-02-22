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

import { loadOnetCatalog, buildCodeLookup, type OnetCatalogRole, type CatalogDelta } from "@/lib/onet/catalog";
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
  v1AutomationShare: number;
  v1AugmentationShare: number;
  v1ManualShare: number;
  v4AutomationShare: number;
  v4AugmentationShare: number;
  v4ManualShare: number;
  automationShareDelta: number;
  augmentationShareDelta: number;
  manualShareDelta: number;
  totalAbsShareDelta: number;
  netAIExposureDelta: number;
  direction: string;
  avgAutoTaskDelta: number;
  avgAugTaskDelta: number;
  avgManualTaskDelta: number;
  totalTaskCount: number;
  workforceWeight: number;
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
    weightedContribution: number;
  }>;
  weightedAutoShareDelta: number;
  weightedAugShareDelta: number;
  weightedManualShareDelta: number;
  weightedNetAIExposureDelta: number;
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
  const clusterMap = new Map<string, OnetCatalogRole[]>();
  for (const role of catalog) {
    const key = role.parentCluster ?? "(Uncategorized)";
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(role);
  }

  let globalTotalTasks = 0;
  for (const role of catalog) {
    globalTotalTasks += role.metrics.taskCount;
  }

  const results: IndustryDelta[] = [];

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

      const v4Auto = role.metrics.automationTasks / tc;
      const v4Aug = role.metrics.augmentationTasks / tc;
      const v4Manual = role.metrics.manualTasks / tc;

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
      v1ManualShare,
      v4AutomationShare: v4AutoShare,
      v4AugmentationShare: v4AugShare,
      v4ManualShare,
      automationShareDelta: autoShareDelta,
      augmentationShareDelta: augShareDelta,
      manualShareDelta,
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

  results.sort((a, b) => b.totalAbsShareDelta - a.totalAbsShareDelta);
  return results;
}

// ---------------------------------------------------------------------------
// Step 2: Load sp100 reports and extract role headcounts from hierarchy
// ---------------------------------------------------------------------------

type CompanyReportEntry = {
  ticker: string;
  slug: string;
  companyName: string;
  hqCountry: string;
  totalHeadcount: number;
  /** Role headcounts aggregated from hierarchy.dominantRoles, keyed by O*NET code */
  roleHeadcounts: Map<string, number>;
  /** Roles array from the report (has parentCluster) */
  roles: Array<{
    onetCode: string;
    parentCluster: string | null;
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

      // Build role headcount map from hierarchy.dominantRoles
      // Each hierarchy node is flat, and its dominantRoles have {id, headcount}
      const roleHeadcounts = new Map<string, number>();
      const hierarchy = report.hierarchy ?? [];
      for (const node of hierarchy) {
        for (const entry of node.dominantRoles ?? []) {
          const code = (entry.id ?? "").trim();
          const hc = entry.headcount ?? 0;
          if (code && hc > 0) {
            roleHeadcounts.set(code, (roleHeadcounts.get(code) ?? 0) + hc);
          }
        }
      }

      // Roles array has parentCluster info
      const roles = (report.roles ?? []).map((r: any) => ({
        onetCode: (r.onetCode ?? "").trim(),
        parentCluster: r.parentCluster ?? null,
      }));

      entries.push({
        ticker: d.ticker ?? "",
        slug: d.slug ?? "",
        companyName: meta.companyName ?? d.companyName ?? "",
        hqCountry: rawCountry,
        totalHeadcount,
        roleHeadcounts,
        roles,
      });
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Step 3: Build country-industry cross-tabs
// Map each company's role headcounts to O*NET clusters, then aggregate by country
// ---------------------------------------------------------------------------

function buildCountryIndustryCrossTabs(
  reports: CompanyReportEntry[],
  codeLookup: Map<string, OnetCatalogRole>
): Map<string, CountryIndustryCell[]> {
  const cellMap = new Map<string, CountryIndustryCell>();

  for (const report of reports) {
    const country = report.hqCountry;
    const isoCode = resolveIsoCode(country);

    // Build a lookup from onetCode -> parentCluster from the report's roles array
    const roleClusterLookup = new Map<string, string>();
    for (const r of report.roles) {
      if (r.onetCode && r.parentCluster) {
        roleClusterLookup.set(r.onetCode, r.parentCluster);
      }
    }

    // For each role with headcount, map to parentCluster
    const clusterHeadcounts = new Map<string, number>();
    for (const [code, hc] of report.roleHeadcounts) {
      // Try report's role array first, then fall back to catalog
      let cluster = roleClusterLookup.get(code);
      if (!cluster) {
        const catalogRole = codeLookup.get(code);
        cluster = catalogRole?.parentCluster ?? null;
      }
      if (!cluster) continue;

      clusterHeadcounts.set(cluster, (clusterHeadcounts.get(cluster) ?? 0) + hc);
    }

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

    industryBreakdown.sort((a, b) => b.headcountShare - a.headcountShare);

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
  v1AIExposure: number;
  v4AIExposure: number;
  v1Rank: number;
  v4Rank: number;
  rankChange: number;
  exposureDelta: number;
};

function computeIndustryRanking(industryDeltas: IndustryDelta[]): IndustryRankEntry[] {
  const entries = industryDeltas.map((d) => ({
    cluster: d.cluster,
    v1AIExposure: round4(d.v1AutomationShare + d.v1AugmentationShare),
    v4AIExposure: round4(d.v4AutomationShare + d.v4AugmentationShare),
    exposureDelta: round4(d.netAIExposureDelta),
  }));

  const byV1 = [...entries].sort((a, b) => b.v1AIExposure - a.v1AIExposure);
  const v1Ranks = new Map<string, number>();
  byV1.forEach((e, i) => v1Ranks.set(e.cluster, i + 1));

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
      rankChange: v1Rank - v4Rank,
    };
  });

  result.sort((a, b) => a.v4Rank - b.v4Rank);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("=".repeat(140));
  console.log("  COUNTRY IMPACT ANALYSIS: How v4 O*NET Changes Affect Countries");
  console.log("=".repeat(140));
  console.log();

  // Step 1: Load catalog and compute industry deltas
  console.log("[1/5] Loading O*NET catalog...");
  const catalog = loadOnetCatalog();
  const codeLookup = buildCodeLookup(catalog);
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

  // Quick diagnostic on role headcount extraction
  let reportsWithRoleHC = 0;
  let totalRoleHCEntries = 0;
  for (const r of reports) {
    if (r.roleHeadcounts.size > 0) {
      reportsWithRoleHC++;
      totalRoleHCEntries += r.roleHeadcounts.size;
    }
  }
  console.log(`  Reports with role headcounts from hierarchy: ${reportsWithRoleHC}`);
  console.log(`  Total role-headcount entries: ${totalRoleHCEntries}`);
  console.log();

  // Step 3: Build country-industry cross-tabs
  console.log("[4/5] Building country-industry cross-tabs...");
  const countryIndustryMap = buildCountryIndustryCrossTabs(reports, codeLookup);
  console.log(`  Found ${countryIndustryMap.size} countries with industry data.`);

  // Diagnostic: total headcount assigned
  let totalAssignedHC = 0;
  for (const [, cells] of countryIndustryMap) {
    for (const cell of cells) {
      totalAssignedHC += cell.headcount;
    }
  }
  console.log(`  Total headcount assigned to country-industry cells: ${totalAssignedHC.toLocaleString()}`);
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

  // Convert Maps to plain objects for JSON serialization
  const crossTabsForJson = Array.from(countryIndustryMap.entries()).map(
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
  );

  const output = {
    generatedAt: new Date().toISOString(),
    methodology: {
      description:
        "Cross-references O*NET v1->v4 industry-level task classification deltas with " +
        "company workforce composition data from sp100-reports.ndjson. For each country, " +
        "the industry mix (by headcount from hierarchy.dominantRoles) is used to weight-average " +
        "the industry-level AI exposure shifts, producing an estimated country-level impact " +
        "of the v4 reclassification.",
      dataVintages: {
        v1: "January 2025 (onetData.json)",
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
      totalHeadcountCovered: totalAssignedHC,
      topCountryByExposureIncrease: (() => {
        const top = countryExposures.find((c) => c.weightedNetAIExposureDelta > 0);
        return top ? { country: top.country, delta: top.weightedNetAIExposureDelta } : null;
      })(),
      topCountryByExposureDecrease: (() => {
        const bottom = [...countryExposures]
          .reverse()
          .find((c) => c.weightedNetAIExposureDelta < 0);
        return bottom ? { country: bottom.country, delta: bottom.weightedNetAIExposureDelta } : null;
      })(),
    },
    industryDeltas,
    industryRanking,
    countryExposures,
    countryIndustryCrossTabs: crossTabsForJson,
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

  console.log("=".repeat(140));
  console.log("  SECTION A: INDUSTRY-LEVEL AI EXPOSURE DELTAS (v1 -> v4)");
  console.log("  Sorted by total absolute share change");
  console.log("=".repeat(140));
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
  console.log("-".repeat(140));

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
  console.log("-".repeat(140));
  console.log();

  // =========================================================================
  // PRINT: Industry Ranking Change
  // =========================================================================

  console.log("=".repeat(140));
  console.log("  SECTION B: INDUSTRY AI EXPOSURE RANKING (v1 vs v4)");
  console.log("  Rank 1 = most AI-exposed. Positive rank change = moved up (more exposed).");
  console.log("=".repeat(140));
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
  console.log("-".repeat(140));

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
  console.log("-".repeat(140));
  console.log();

  // =========================================================================
  // PRINT: Country Exposure Summary
  // =========================================================================

  if (countryExposures.length > 0) {
    console.log("=".repeat(140));
    console.log("  SECTION C: COUNTRY-LEVEL EXPOSURE DELTAS");
    console.log("  Weighted by each country's industry composition (headcount-based from hierarchy.dominantRoles).");
    console.log("  Interpretation: if a country's workforce is concentrated in industries");
    console.log("  that saw large v4 reclassifications, the country has higher exposure delta.");
    console.log("=".repeat(140));
    console.log();

    const hdr3 = [
      padRight("#", 3),
      padRight("Country", 26),
      padLeft("ISO", 4),
      padLeft("Cos", 5),
      padLeft("Headcount", 12),
      padLeft("Net AI D", 10),
      padLeft("Auto D", 10),
      padLeft("Aug D", 10),
      padRight("  Top+ Industry", 32),
      padRight("  Direction", 26),
    ].join(" ");

    console.log(hdr3);
    console.log("-".repeat(140));

    for (let i = 0; i < countryExposures.length; i++) {
      const c = countryExposures[i];
      const row = [
        padRight(String(i + 1), 3),
        padRight(c.country.slice(0, 26), 26),
        padLeft(c.isoCode ?? "??", 4),
        padLeft(String(c.companyCount), 5),
        padLeft(c.totalHeadcount.toLocaleString(), 12),
        padLeft(signPct(c.weightedNetAIExposureDelta), 10),
        padLeft(signPct(c.weightedAutoShareDelta), 10),
        padLeft(signPct(c.weightedAugShareDelta), 10),
        "  " + padRight((c.topPositiveIndustry ?? "N/A").slice(0, 30), 30),
        "  " + c.exposureDirection,
      ].join(" ");
      console.log(row);
    }
    console.log("-".repeat(140));
    console.log();

    // =========================================================================
    // PRINT: Detailed country breakdowns (top 10)
    // =========================================================================

    console.log("=".repeat(140));
    console.log("  SECTION D: DETAILED COUNTRY BREAKDOWNS (top 10 by absolute exposure delta)");
    console.log("=".repeat(140));

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

    console.log();

    // =========================================================================
    // PRINT: Summary interpretation
    // =========================================================================

    console.log("=".repeat(140));
    console.log("  SECTION E: INTERPRETATION GUIDE");
    console.log("=".repeat(140));
    console.log();
    console.log("  How to read the country exposure deltas:");
    console.log();
    console.log("  The 'Net AI Delta' for each country represents the headcount-weighted average");
    console.log("  shift in AI exposure (automation + augmentation share) across all O*NET");
    console.log("  industry clusters present in that country's company workforce data.");
    console.log();
    console.log("  Example: If Country X has 60% of workforce in 'Computer and Mathematical'");
    console.log("  (which saw +1.98% AI exposure shift) and 40% in 'Management'");
    console.log("  (which saw +2.04% shift), then:");
    console.log("    Country X Net AI Delta = 0.60 * 1.98% + 0.40 * 2.04% = +1.19% + 0.82% = +2.01%");
    console.log();
    console.log("  Key findings:");

    const increasing = countryExposures.filter((c) => c.weightedNetAIExposureDelta > 0.002);
    const stable = countryExposures.filter(
      (c) => Math.abs(c.weightedNetAIExposureDelta) <= 0.002
    );
    const decreasing = countryExposures.filter((c) => c.weightedNetAIExposureDelta < -0.002);

    console.log(`    - ${increasing.length} countries with INCREASING AI exposure`);
    console.log(`    - ${stable.length} countries with STABLE exposure`);
    console.log(`    - ${decreasing.length} countries with DECREASING AI exposure`);

    if (increasing.length > 0) {
      console.log();
      console.log("  Most affected (increasing):");
      for (const c of increasing.slice(0, 5)) {
        console.log(
          `    ${c.country}: ${signPct(c.weightedNetAIExposureDelta)} net AI shift` +
            ` (driven by ${c.topPositiveIndustry ?? "multiple sectors"})`
        );
      }
    }

  } else {
    console.log("  [INFO] No country exposure data available (no company reports loaded).");
    console.log("  The industry-level deltas (Sections A and B above) are still valid.");
  }

  console.log();
  console.log("=".repeat(140));
  console.log("  ANALYSIS COMPLETE");
  console.log(`  Full JSON output: /tmp/country-impact-analysis.json`);
  console.log("=".repeat(140));
}

main();
