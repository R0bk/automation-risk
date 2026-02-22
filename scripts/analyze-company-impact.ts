/**
 * analyze-company-impact.ts
 *
 * Analyzes how the O*NET v4 data change (Jan 2025 -> Nov 2025) affects existing
 * company runs. For each company with a stored report, we:
 *   - Extract all roles from hierarchy dominantRoles (with headcounts)
 *   - Look up each role's v4 delta from the O*NET catalog
 *   - Compute headcount-weighted impact changes
 *   - Rank companies by biggest increases, decreases, and automation->augmentation shifts
 *
 * Data source: saved/sp100-reports.ndjson (NDJSON file with company reports)
 * The project uses PostgreSQL (via drizzle-orm + @vercel/postgres), but no
 * POSTGRES_URL is configured in this environment. Reports are available as
 * an NDJSON export, so we read from that file instead.
 *
 * Usage: pnpm tsx scripts/analyze-company-impact.ts
 */

import { loadOnetCatalog, buildCodeLookup } from "@/lib/onet/catalog";
import type { OnetCatalogRole, CatalogDelta } from "@/lib/onet/catalog";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DominantRoleEntry = { id: string; headcount: number | null };

type HierarchyNode = {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  headcount?: number | null;
  dominantRoles?: DominantRoleEntry[];
};

type ReportJson = {
  metadata: {
    companyName: string;
    companySlug: string;
    summary?: string;
    hqCountry?: string;
    workforceEstimate?: number | null;
  };
  hierarchy: HierarchyNode[];
  roles?: Array<{
    onetCode: string;
    title: string;
    headcount?: number | null;
    automationShare?: number | null;
    augmentationShare?: number | null;
  }>;
};

type NdjsonLine = {
  ticker: string;
  slug: string;
  companyName: string;
  runId: string;
  report: ReportJson;
  exportedAt?: string;
};

type RoleImpact = {
  onetCode: string;
  title: string;
  parentCluster: string | null;
  headcount: number;
  automationTasksDelta: number;
  augmentationTasksDelta: number;
  manualTasksDelta: number;
  /** Net AI exposure delta = automationDelta + augmentationDelta */
  netAiExposureDelta: number;
  /** Shift from automation to augmentation: augDelta - autoDelta when autoDelta < 0 and augDelta > 0 */
  autoToAugShift: number;
  taskCount: number;
  v4AutomationTasks: number;
  v4AugmentationTasks: number;
  v4ManualTasks: number;
  priorAutomationTasks: number;
  priorAugmentationTasks: number;
  priorManualTasks: number;
};

type CompanyImpact = {
  slug: string;
  ticker: string;
  companyName: string;
  runId: string;
  hqCountry: string | null;
  workforceEstimate: number | null;
  totalMappedHeadcount: number;
  uniqueRolesCount: number;
  rolesWithDeltaCount: number;
  rolesWithoutDeltaCount: number;
  /** Headcount-weighted average of net AI exposure delta per task */
  weightedNetAiExposureDelta: number;
  /** Headcount-weighted average of automation tasks delta */
  weightedAutomationDelta: number;
  /** Headcount-weighted average of augmentation tasks delta */
  weightedAugmentationDelta: number;
  /** Headcount-weighted average of manual tasks delta */
  weightedManualDelta: number;
  /** Total headcount in roles shifting from automation -> augmentation */
  autoToAugShiftHeadcount: number;
  /** Weighted auto-to-aug shift score */
  weightedAutoToAugShift: number;
  /** Per-role breakdown */
  roles: RoleImpact[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round3(v: number): number {
  return Number(v.toFixed(3));
}

function sign(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}

function signF(v: number, decimals = 3): string {
  const s = v.toFixed(decimals);
  return v > 0 ? `+${s}` : s;
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // -----------------------------------------------------------------------
  // 1. Load the O*NET catalog
  // -----------------------------------------------------------------------
  console.log("Loading O*NET catalog...");
  const catalog = loadOnetCatalog();
  const codeLookup = buildCodeLookup(catalog);
  console.log(`  Loaded ${catalog.length} roles from catalog.`);
  console.log(`  Roles with delta info: ${catalog.filter(r => r.delta != null).length}`);
  console.log();

  // -----------------------------------------------------------------------
  // 2. Load company reports from NDJSON
  // -----------------------------------------------------------------------
  const ndjsonPath = resolve("saved/sp100-reports.ndjson");
  console.log(`Loading company reports from ${ndjsonPath}...`);
  const rawLines = readFileSync(ndjsonPath, "utf-8").split("\n").filter(Boolean);
  console.log(`  Found ${rawLines.length} report lines.`);
  console.log();

  // -----------------------------------------------------------------------
  // 3. Process each company
  // -----------------------------------------------------------------------
  const companies: CompanyImpact[] = [];
  let totalSkipped = 0;

  for (const line of rawLines) {
    let parsed: NdjsonLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      totalSkipped++;
      continue;
    }

    const report = parsed.report;
    if (!report?.hierarchy?.length) {
      totalSkipped++;
      continue;
    }

    // Extract all dominant roles from hierarchy with their headcounts
    // Aggregate headcounts per onetCode across all hierarchy nodes
    const roleHeadcountMap = new Map<string, number>();

    for (const node of report.hierarchy) {
      if (!node.dominantRoles?.length) continue;
      for (const entry of node.dominantRoles) {
        const code = entry.id?.trim();
        if (!code) continue;
        const hc = typeof entry.headcount === "number" && entry.headcount > 0 ? entry.headcount : 0;
        roleHeadcountMap.set(code, (roleHeadcountMap.get(code) ?? 0) + hc);
      }
    }

    if (roleHeadcountMap.size === 0) {
      totalSkipped++;
      continue;
    }

    // Look up each role in the catalog and compute deltas
    const roleImpacts: RoleImpact[] = [];
    let rolesWithDelta = 0;
    let rolesWithoutDelta = 0;

    for (const [code, headcount] of roleHeadcountMap) {
      // Try exact code match first, then prefix match (e.g. 15-1132 -> 15-1132.00)
      let catalogRole = codeLookup.get(code);
      if (!catalogRole) {
        // Try stripping trailing .00 or adding it
        const stripped = code.replace(/\.00$/, "");
        const withSuffix = stripped.includes(".") ? stripped : `${stripped}.00`;
        catalogRole = codeLookup.get(withSuffix) ?? codeLookup.get(stripped);
      }

      if (!catalogRole || !catalogRole.delta || !catalogRole.prior) {
        rolesWithoutDelta++;
        continue;
      }

      rolesWithDelta++;
      const delta = catalogRole.delta;
      const netAiExposure = delta.automationTasksDelta + delta.augmentationTasksDelta;

      // Detect auto->aug shift: automation decreased AND augmentation increased
      let autoToAugShift = 0;
      if (delta.automationTasksDelta < 0 && delta.augmentationTasksDelta > 0) {
        autoToAugShift = delta.augmentationTasksDelta + Math.abs(delta.automationTasksDelta);
      }

      roleImpacts.push({
        onetCode: code,
        title: catalogRole.title,
        parentCluster: catalogRole.parentCluster,
        headcount,
        automationTasksDelta: delta.automationTasksDelta,
        augmentationTasksDelta: delta.augmentationTasksDelta,
        manualTasksDelta: delta.manualTasksDelta,
        netAiExposureDelta: netAiExposure,
        autoToAugShift,
        taskCount: catalogRole.metrics.taskCount,
        v4AutomationTasks: catalogRole.metrics.automationTasks,
        v4AugmentationTasks: catalogRole.metrics.augmentationTasks,
        v4ManualTasks: catalogRole.metrics.manualTasks,
        priorAutomationTasks: catalogRole.prior.automationTasks,
        priorAugmentationTasks: catalogRole.prior.augmentationTasks,
        priorManualTasks: catalogRole.prior.manualTasks,
      });
    }

    if (roleImpacts.length === 0) {
      totalSkipped++;
      continue;
    }

    // Compute headcount-weighted averages
    const totalMappedHeadcount = roleImpacts.reduce((s, r) => s + r.headcount, 0);

    // Use headcount as weight, but fall back to equal weighting if all headcounts are 0
    const useHeadcountWeights = totalMappedHeadcount > 0;
    const effectiveWeights = roleImpacts.map(r =>
      useHeadcountWeights ? r.headcount : 1
    );
    const totalWeight = effectiveWeights.reduce((s, w) => s + w, 0);

    let weightedNetAi = 0;
    let weightedAuto = 0;
    let weightedAug = 0;
    let weightedManual = 0;
    let weightedAutoToAug = 0;
    let autoToAugHeadcount = 0;

    for (let i = 0; i < roleImpacts.length; i++) {
      const r = roleImpacts[i];
      const w = effectiveWeights[i] / totalWeight;
      weightedNetAi += r.netAiExposureDelta * w;
      weightedAuto += r.automationTasksDelta * w;
      weightedAug += r.augmentationTasksDelta * w;
      weightedManual += r.manualTasksDelta * w;
      weightedAutoToAug += r.autoToAugShift * w;
      if (r.autoToAugShift > 0) {
        autoToAugHeadcount += r.headcount;
      }
    }

    companies.push({
      slug: parsed.slug,
      ticker: parsed.ticker,
      companyName: parsed.companyName,
      runId: parsed.runId,
      hqCountry: report.metadata?.hqCountry ?? null,
      workforceEstimate: report.metadata?.workforceEstimate ?? null,
      totalMappedHeadcount,
      uniqueRolesCount: roleHeadcountMap.size,
      rolesWithDeltaCount: rolesWithDelta,
      rolesWithoutDeltaCount: rolesWithoutDelta,
      weightedNetAiExposureDelta: round3(weightedNetAi),
      weightedAutomationDelta: round3(weightedAuto),
      weightedAugmentationDelta: round3(weightedAug),
      weightedManualDelta: round3(weightedManual),
      autoToAugShiftHeadcount: autoToAugHeadcount,
      weightedAutoToAugShift: round3(weightedAutoToAug),
      roles: roleImpacts,
    });
  }

  console.log(`Processed ${companies.length} companies with valid role data.`);
  console.log(`Skipped ${totalSkipped} entries (no hierarchy/roles/deltas).`);
  console.log();

  // -----------------------------------------------------------------------
  // 4. Rank companies
  // -----------------------------------------------------------------------

  // Rank 1: Biggest INCREASE in AI exposure (more tasks now automatable/augmentable)
  const byExposureIncrease = [...companies]
    .filter(c => c.weightedNetAiExposureDelta > 0)
    .sort((a, b) => b.weightedNetAiExposureDelta - a.weightedNetAiExposureDelta);

  // Rank 2: Biggest DECREASE in AI exposure
  const byExposureDecrease = [...companies]
    .filter(c => c.weightedNetAiExposureDelta < 0)
    .sort((a, b) => a.weightedNetAiExposureDelta - b.weightedNetAiExposureDelta);

  // Rank 3: Biggest shift from automation -> augmentation
  const byAutoToAugShift = [...companies]
    .filter(c => c.weightedAutoToAugShift > 0)
    .sort((a, b) => b.weightedAutoToAugShift - a.weightedAutoToAugShift);

  // Rank 4: Overall by absolute magnitude of change
  const byAbsoluteChange = [...companies]
    .sort((a, b) =>
      Math.abs(b.weightedNetAiExposureDelta) - Math.abs(a.weightedNetAiExposureDelta)
    );

  // -----------------------------------------------------------------------
  // 5. Summary statistics
  // -----------------------------------------------------------------------
  const avgWeightedNetAi = companies.length > 0
    ? round3(companies.reduce((s, c) => s + c.weightedNetAiExposureDelta, 0) / companies.length)
    : 0;
  const avgWeightedAuto = companies.length > 0
    ? round3(companies.reduce((s, c) => s + c.weightedAutomationDelta, 0) / companies.length)
    : 0;
  const avgWeightedAug = companies.length > 0
    ? round3(companies.reduce((s, c) => s + c.weightedAugmentationDelta, 0) / companies.length)
    : 0;
  const avgWeightedManual = companies.length > 0
    ? round3(companies.reduce((s, c) => s + c.weightedManualDelta, 0) / companies.length)
    : 0;

  const companiesWithIncrease = companies.filter(c => c.weightedNetAiExposureDelta > 0).length;
  const companiesWithDecrease = companies.filter(c => c.weightedNetAiExposureDelta < 0).length;
  const companiesNoChange = companies.filter(c => c.weightedNetAiExposureDelta === 0).length;
  const companiesWithAutoToAug = companies.filter(c => c.weightedAutoToAugShift > 0).length;

  const totalMappedWorkforce = companies.reduce((s, c) => s + c.totalMappedHeadcount, 0);
  const totalEstimatedWorkforce = companies.reduce((s, c) => s + (c.workforceEstimate ?? 0), 0);

  // -----------------------------------------------------------------------
  // 6. Build and write JSON output
  // -----------------------------------------------------------------------
  const output = {
    generatedAt: new Date().toISOString(),
    dataSource: "saved/sp100-reports.ndjson (S&P 100 company reports)",
    catalogInfo: {
      totalCatalogRoles: catalog.length,
      catalogRolesWithDelta: catalog.filter(r => r.delta != null).length,
    },
    summary: {
      totalCompanies: companies.length,
      skippedEntries: totalSkipped,
      totalEstimatedWorkforce,
      totalMappedWorkforce,
      companiesWithAiExposureIncrease: companiesWithIncrease,
      companiesWithAiExposureDecrease: companiesWithDecrease,
      companiesWithNoChange: companiesNoChange,
      companiesWithAutoToAugShift: companiesWithAutoToAug,
      averages: {
        weightedNetAiExposureDelta: avgWeightedNetAi,
        weightedAutomationDelta: avgWeightedAuto,
        weightedAugmentationDelta: avgWeightedAug,
        weightedManualDelta: avgWeightedManual,
      },
    },
    rankings: {
      biggestAiExposureIncrease: byExposureIncrease.slice(0, 25).map(c => ({
        rank: 0,
        ticker: c.ticker,
        slug: c.slug,
        companyName: c.companyName,
        hqCountry: c.hqCountry,
        workforceEstimate: c.workforceEstimate,
        totalMappedHeadcount: c.totalMappedHeadcount,
        rolesWithDelta: c.rolesWithDeltaCount,
        weightedNetAiExposureDelta: c.weightedNetAiExposureDelta,
        weightedAutomationDelta: c.weightedAutomationDelta,
        weightedAugmentationDelta: c.weightedAugmentationDelta,
        weightedManualDelta: c.weightedManualDelta,
      })).map((c, i) => ({ ...c, rank: i + 1 })),

      biggestAiExposureDecrease: byExposureDecrease.slice(0, 25).map(c => ({
        rank: 0,
        ticker: c.ticker,
        slug: c.slug,
        companyName: c.companyName,
        hqCountry: c.hqCountry,
        workforceEstimate: c.workforceEstimate,
        totalMappedHeadcount: c.totalMappedHeadcount,
        rolesWithDelta: c.rolesWithDeltaCount,
        weightedNetAiExposureDelta: c.weightedNetAiExposureDelta,
        weightedAutomationDelta: c.weightedAutomationDelta,
        weightedAugmentationDelta: c.weightedAugmentationDelta,
        weightedManualDelta: c.weightedManualDelta,
      })).map((c, i) => ({ ...c, rank: i + 1 })),

      biggestAutoToAugShift: byAutoToAugShift.slice(0, 25).map(c => ({
        rank: 0,
        ticker: c.ticker,
        slug: c.slug,
        companyName: c.companyName,
        hqCountry: c.hqCountry,
        workforceEstimate: c.workforceEstimate,
        totalMappedHeadcount: c.totalMappedHeadcount,
        autoToAugShiftHeadcount: c.autoToAugShiftHeadcount,
        weightedAutoToAugShift: c.weightedAutoToAugShift,
        weightedAutomationDelta: c.weightedAutomationDelta,
        weightedAugmentationDelta: c.weightedAugmentationDelta,
      })).map((c, i) => ({ ...c, rank: i + 1 })),

      byAbsoluteChange: byAbsoluteChange.slice(0, 25).map(c => ({
        rank: 0,
        ticker: c.ticker,
        slug: c.slug,
        companyName: c.companyName,
        hqCountry: c.hqCountry,
        absChange: round3(Math.abs(c.weightedNetAiExposureDelta)),
        weightedNetAiExposureDelta: c.weightedNetAiExposureDelta,
        weightedAutomationDelta: c.weightedAutomationDelta,
        weightedAugmentationDelta: c.weightedAugmentationDelta,
        direction: c.weightedNetAiExposureDelta > 0 ? "INCREASE" : c.weightedNetAiExposureDelta < 0 ? "DECREASE" : "STABLE",
      })).map((c, i) => ({ ...c, rank: i + 1 })),
    },
    allCompanies: companies.map(c => ({
      ticker: c.ticker,
      slug: c.slug,
      companyName: c.companyName,
      hqCountry: c.hqCountry,
      workforceEstimate: c.workforceEstimate,
      totalMappedHeadcount: c.totalMappedHeadcount,
      uniqueRolesCount: c.uniqueRolesCount,
      rolesWithDeltaCount: c.rolesWithDeltaCount,
      rolesWithoutDeltaCount: c.rolesWithoutDeltaCount,
      weightedNetAiExposureDelta: c.weightedNetAiExposureDelta,
      weightedAutomationDelta: c.weightedAutomationDelta,
      weightedAugmentationDelta: c.weightedAugmentationDelta,
      weightedManualDelta: c.weightedManualDelta,
      autoToAugShiftHeadcount: c.autoToAugShiftHeadcount,
      weightedAutoToAugShift: c.weightedAutoToAugShift,
      topImpactedRoles: c.roles
        .sort((a, b) => Math.abs(b.netAiExposureDelta * b.headcount) - Math.abs(a.netAiExposureDelta * a.headcount))
        .slice(0, 5)
        .map(r => ({
          onetCode: r.onetCode,
          title: r.title,
          headcount: r.headcount,
          automationTasksDelta: r.automationTasksDelta,
          augmentationTasksDelta: r.augmentationTasksDelta,
          manualTasksDelta: r.manualTasksDelta,
          netAiExposureDelta: r.netAiExposureDelta,
        })),
    })),
  };

  const outPath = "/tmp/company-impact-analysis.json";
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`JSON output written to ${outPath}`);
  console.log();

  // -----------------------------------------------------------------------
  // 7. Print human-readable summary to stdout
  // -----------------------------------------------------------------------

  console.log("=".repeat(100));
  console.log("  COMPANY IMPACT ANALYSIS: O*NET v1 (Jan 2025) -> v4 (Nov 2025)");
  console.log("  Data source: S&P 100 company analysis reports");
  console.log("=".repeat(100));
  console.log();
  console.log(`  Companies analyzed:                ${companies.length}`);
  console.log(`  Skipped entries:                   ${totalSkipped}`);
  console.log(`  Total estimated workforce:         ${totalEstimatedWorkforce.toLocaleString()}`);
  console.log(`  Total mapped headcount (w/ roles): ${totalMappedWorkforce.toLocaleString()}`);
  console.log();
  console.log("-".repeat(100));
  console.log("  AGGREGATE IMPACT ACROSS ALL COMPANIES");
  console.log("-".repeat(100));
  console.log(`  Companies with INCREASED AI exposure:      ${companiesWithIncrease}`);
  console.log(`  Companies with DECREASED AI exposure:      ${companiesWithDecrease}`);
  console.log(`  Companies with NO net change:              ${companiesNoChange}`);
  console.log(`  Companies with auto->aug shift:            ${companiesWithAutoToAug}`);
  console.log();
  console.log(`  Avg weighted net AI exposure delta:        ${signF(avgWeightedNetAi)} tasks`);
  console.log(`  Avg weighted automation tasks delta:       ${signF(avgWeightedAuto)} tasks`);
  console.log(`  Avg weighted augmentation tasks delta:     ${signF(avgWeightedAug)} tasks`);
  console.log(`  Avg weighted manual tasks delta:           ${signF(avgWeightedManual)} tasks`);
  console.log();

  // --- Ranking 1: Biggest AI exposure increase ---
  console.log("-".repeat(100));
  console.log("  TOP 15 COMPANIES: BIGGEST AI EXPOSURE INCREASE (more tasks now automatable/augmentable)");
  console.log("-".repeat(100));
  console.log();
  const incHeader = [
    padRight("#", 4),
    padRight("Ticker", 7),
    padRight("Company", 32),
    padLeft("Workforce", 10),
    padLeft("Mapped HC", 10),
    padLeft("Roles", 6),
    padLeft("NetAI", 8),
    padLeft("Auto", 8),
    padLeft("Aug", 8),
    padLeft("Manual", 8),
  ].join("");
  console.log(incHeader);
  console.log("-".repeat(100));

  for (let i = 0; i < Math.min(15, byExposureIncrease.length); i++) {
    const c = byExposureIncrease[i];
    const row = [
      padRight(String(i + 1), 4),
      padRight(c.ticker, 7),
      padRight(c.companyName.slice(0, 31), 32),
      padLeft(c.workforceEstimate?.toLocaleString() ?? "N/A", 10),
      padLeft(c.totalMappedHeadcount.toLocaleString(), 10),
      padLeft(String(c.rolesWithDeltaCount), 6),
      padLeft(signF(c.weightedNetAiExposureDelta), 8),
      padLeft(signF(c.weightedAutomationDelta), 8),
      padLeft(signF(c.weightedAugmentationDelta), 8),
      padLeft(signF(c.weightedManualDelta), 8),
    ].join("");
    console.log(row);
  }
  console.log();

  // --- Ranking 2: Biggest AI exposure decrease ---
  console.log("-".repeat(100));
  console.log("  TOP 15 COMPANIES: BIGGEST AI EXPOSURE DECREASE (fewer tasks now automatable/augmentable)");
  console.log("-".repeat(100));
  console.log();
  console.log(incHeader);
  console.log("-".repeat(100));

  for (let i = 0; i < Math.min(15, byExposureDecrease.length); i++) {
    const c = byExposureDecrease[i];
    const row = [
      padRight(String(i + 1), 4),
      padRight(c.ticker, 7),
      padRight(c.companyName.slice(0, 31), 32),
      padLeft(c.workforceEstimate?.toLocaleString() ?? "N/A", 10),
      padLeft(c.totalMappedHeadcount.toLocaleString(), 10),
      padLeft(String(c.rolesWithDeltaCount), 6),
      padLeft(signF(c.weightedNetAiExposureDelta), 8),
      padLeft(signF(c.weightedAutomationDelta), 8),
      padLeft(signF(c.weightedAugmentationDelta), 8),
      padLeft(signF(c.weightedManualDelta), 8),
    ].join("");
    console.log(row);
  }
  console.log();

  // --- Ranking 3: Biggest auto->aug shift ---
  console.log("-".repeat(100));
  console.log("  TOP 15 COMPANIES: BIGGEST AUTOMATION -> AUGMENTATION SHIFT");
  console.log("  (Roles where automation decreased AND augmentation increased simultaneously)");
  console.log("-".repeat(100));
  console.log();
  const shiftHeader = [
    padRight("#", 4),
    padRight("Ticker", 7),
    padRight("Company", 32),
    padLeft("Workforce", 10),
    padLeft("Shift HC", 9),
    padLeft("WtShift", 8),
    padLeft("Auto", 8),
    padLeft("Aug", 8),
  ].join("");
  console.log(shiftHeader);
  console.log("-".repeat(100));

  for (let i = 0; i < Math.min(15, byAutoToAugShift.length); i++) {
    const c = byAutoToAugShift[i];
    const row = [
      padRight(String(i + 1), 4),
      padRight(c.ticker, 7),
      padRight(c.companyName.slice(0, 31), 32),
      padLeft(c.workforceEstimate?.toLocaleString() ?? "N/A", 10),
      padLeft(c.autoToAugShiftHeadcount.toLocaleString(), 9),
      padLeft(signF(c.weightedAutoToAugShift), 8),
      padLeft(signF(c.weightedAutomationDelta), 8),
      padLeft(signF(c.weightedAugmentationDelta), 8),
    ].join("");
    console.log(row);
  }
  console.log();

  // --- Ranking 4: By absolute change ---
  console.log("-".repeat(100));
  console.log("  TOP 15 COMPANIES: BIGGEST ABSOLUTE CHANGE IN AI EXPOSURE (either direction)");
  console.log("-".repeat(100));
  console.log();
  const absHeader = [
    padRight("#", 4),
    padRight("Ticker", 7),
    padRight("Company", 32),
    padLeft("|Change|", 9),
    padLeft("NetAI", 8),
    padLeft("Direction", 10),
    padLeft("Auto", 8),
    padLeft("Aug", 8),
  ].join("");
  console.log(absHeader);
  console.log("-".repeat(100));

  for (let i = 0; i < Math.min(15, byAbsoluteChange.length); i++) {
    const c = byAbsoluteChange[i];
    const direction = c.weightedNetAiExposureDelta > 0 ? "INCREASE" : c.weightedNetAiExposureDelta < 0 ? "DECREASE" : "STABLE";
    const row = [
      padRight(String(i + 1), 4),
      padRight(c.ticker, 7),
      padRight(c.companyName.slice(0, 31), 32),
      padLeft(Math.abs(c.weightedNetAiExposureDelta).toFixed(3), 9),
      padLeft(signF(c.weightedNetAiExposureDelta), 8),
      padLeft(direction, 10),
      padLeft(signF(c.weightedAutomationDelta), 8),
      padLeft(signF(c.weightedAugmentationDelta), 8),
    ].join("");
    console.log(row);
  }
  console.log();

  // --- Per-company role details for top 5 most impacted ---
  console.log("-".repeat(100));
  console.log("  ROLE-LEVEL DETAIL: TOP 5 MOST IMPACTED COMPANIES (by absolute weighted change)");
  console.log("-".repeat(100));

  for (let i = 0; i < Math.min(5, byAbsoluteChange.length); i++) {
    const c = byAbsoluteChange[i];
    console.log();
    console.log(`  ${i + 1}. ${c.companyName} [${c.ticker}] (${c.slug})`);
    console.log(`     Workforce est: ${c.workforceEstimate?.toLocaleString() ?? "N/A"} | Mapped HC: ${c.totalMappedHeadcount.toLocaleString()} | Roles with delta: ${c.rolesWithDeltaCount}`);
    console.log(`     Weighted deltas -> Net AI: ${signF(c.weightedNetAiExposureDelta)}, Auto: ${signF(c.weightedAutomationDelta)}, Aug: ${signF(c.weightedAugmentationDelta)}, Manual: ${signF(c.weightedManualDelta)}`);
    console.log(`     Auto->Aug shift headcount: ${c.autoToAugShiftHeadcount.toLocaleString()}`);
    console.log();

    // Show top 10 roles by headcount-weighted impact
    const sortedRoles = [...c.roles]
      .sort((a, b) => Math.abs(b.netAiExposureDelta * b.headcount) - Math.abs(a.netAiExposureDelta * a.headcount))
      .slice(0, 10);

    const roleHeader = `     ${padRight("O*NET Code", 14)}${padRight("Role Title", 36)}${padLeft("HC", 7)}${padLeft("AutoD", 7)}${padLeft("AugD", 7)}${padLeft("ManD", 7)}${padLeft("NetAI", 7)}`;
    console.log(roleHeader);
    console.log(`     ${"-".repeat(85)}`);

    for (const r of sortedRoles) {
      const rRow = `     ${padRight(r.onetCode, 14)}${padRight(r.title.slice(0, 35), 36)}${padLeft(r.headcount.toLocaleString(), 7)}${padLeft(sign(r.automationTasksDelta), 7)}${padLeft(sign(r.augmentationTasksDelta), 7)}${padLeft(sign(r.manualTasksDelta), 7)}${padLeft(sign(r.netAiExposureDelta), 7)}`;
      console.log(rRow);
    }
  }

  console.log();
  console.log("=".repeat(100));
  console.log("  DONE");
  console.log(`  Full results: ${outPath}`);
  console.log("=".repeat(100));
}

main();
