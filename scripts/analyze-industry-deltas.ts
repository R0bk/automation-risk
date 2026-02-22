import { loadOnetCatalog } from "@/lib/onet/catalog";
import type { OnetCatalogRole, CatalogDelta, VintageSnapshot } from "@/lib/onet/catalog";
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoleWithDelta = OnetCatalogRole & {
  delta: NonNullable<OnetCatalogRole["delta"]>;
  prior: NonNullable<OnetCatalogRole["prior"]>;
};

type TopChangedRole = {
  code: string;
  title: string;
  automationDelta: number;
  augmentationDelta: number;
  manualDelta: number;
  absTotalChange: number;
};

type IndustryAnalysis = {
  industry: string;
  totalRoles: number;
  rolesWithChanges: number;
  totalAutomationGained: number;
  totalAutomationLost: number;
  totalAugmentationGained: number;
  totalAugmentationLost: number;
  totalManualGained: number;
  totalManualLost: number;
  netAutomationDelta: number;
  netAugmentationDelta: number;
  netManualDelta: number;
  avgAutomationDelta: number;
  avgAugmentationDelta: number;
  topChangedRoles: TopChangedRole[];
  totalAbsoluteChange: number;
  netDirection: string;
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
  const catalog = loadOnetCatalog();
  console.log(`Loaded ${catalog.length} roles from O*NET catalog.\n`);

  // 1. Group roles by parentCluster (industry)
  const industryMap = new Map<string, OnetCatalogRole[]>();
  for (const role of catalog) {
    const key = role.parentCluster ?? "(Uncategorized)";
    if (!industryMap.has(key)) {
      industryMap.set(key, []);
    }
    industryMap.get(key)!.push(role);
  }

  // 2. Compute per-industry metrics
  const industries: IndustryAnalysis[] = [];

  for (const [industry, roles] of industryMap) {
    const rolesWithDeltas = roles.filter(
      (r): r is RoleWithDelta => r.delta != null && r.prior != null
    );

    // Count roles that actually changed (any non-zero delta)
    const rolesWithChanges = rolesWithDeltas.filter(
      (r) =>
        r.delta.automationTasksDelta !== 0 ||
        r.delta.augmentationTasksDelta !== 0 ||
        r.delta.manualTasksDelta !== 0
    ).length;

    // Aggregate gains and losses separately
    let totalAutomationGained = 0;
    let totalAutomationLost = 0;
    let totalAugmentationGained = 0;
    let totalAugmentationLost = 0;
    let totalManualGained = 0;
    let totalManualLost = 0;

    for (const r of rolesWithDeltas) {
      if (r.delta.automationTasksDelta > 0) {
        totalAutomationGained += r.delta.automationTasksDelta;
      } else {
        totalAutomationLost += r.delta.automationTasksDelta; // negative
      }

      if (r.delta.augmentationTasksDelta > 0) {
        totalAugmentationGained += r.delta.augmentationTasksDelta;
      } else {
        totalAugmentationLost += r.delta.augmentationTasksDelta;
      }

      if (r.delta.manualTasksDelta > 0) {
        totalManualGained += r.delta.manualTasksDelta;
      } else {
        totalManualLost += r.delta.manualTasksDelta;
      }
    }

    const netAutomationDelta = totalAutomationGained + totalAutomationLost;
    const netAugmentationDelta = totalAugmentationGained + totalAugmentationLost;
    const netManualDelta = totalManualGained + totalManualLost;

    // Average deltas per role (across all roles with delta info)
    const n = rolesWithDeltas.length || 1;
    const avgAutomationDelta = round3(netAutomationDelta / n);
    const avgAugmentationDelta = round3(netAugmentationDelta / n);

    // Total absolute change (sum of all absolute deltas across all dimensions)
    const totalAbsoluteChange = rolesWithDeltas.reduce((sum, r) => {
      return (
        sum +
        Math.abs(r.delta.automationTasksDelta) +
        Math.abs(r.delta.augmentationTasksDelta) +
        Math.abs(r.delta.manualTasksDelta)
      );
    }, 0);

    // Top 3 most-changed roles within this industry
    const rolesByChange = rolesWithDeltas
      .map((r) => {
        const absTotalChange =
          Math.abs(r.delta.automationTasksDelta) +
          Math.abs(r.delta.augmentationTasksDelta) +
          Math.abs(r.delta.manualTasksDelta);
        return {
          code: r.code,
          title: r.title,
          automationDelta: r.delta.automationTasksDelta,
          augmentationDelta: r.delta.augmentationTasksDelta,
          manualDelta: r.delta.manualTasksDelta,
          absTotalChange,
        };
      })
      .sort((a, b) => b.absTotalChange - a.absTotalChange)
      .slice(0, 3);

    // NET direction: is AI exposure increasing or decreasing?
    const netAIExposure = netAutomationDelta + netAugmentationDelta;
    let netDirection: string;
    if (netAIExposure > 0) {
      netDirection = "INCREASING AI exposure";
    } else if (netAIExposure < 0) {
      netDirection = "DECREASING AI exposure";
    } else {
      netDirection = "STABLE (no net change)";
    }

    industries.push({
      industry,
      totalRoles: roles.length,
      rolesWithChanges,
      totalAutomationGained,
      totalAutomationLost,
      totalAugmentationGained,
      totalAugmentationLost,
      totalManualGained,
      totalManualLost,
      netAutomationDelta,
      netAugmentationDelta,
      netManualDelta,
      avgAutomationDelta,
      avgAugmentationDelta,
      topChangedRoles: rolesByChange,
      totalAbsoluteChange,
      netDirection,
    });
  }

  // 3. Sort by total absolute change (biggest movers first)
  industries.sort((a, b) => b.totalAbsoluteChange - a.totalAbsoluteChange);

  // 4. Write JSON output
  const output = {
    generatedAt: new Date().toISOString(),
    totalIndustries: industries.length,
    totalRoles: catalog.length,
    industries,
  };

  writeFileSync("/tmp/industry-deltas-analysis.json", JSON.stringify(output, null, 2), "utf-8");
  console.log("JSON output written to /tmp/industry-deltas-analysis.json\n");

  // 5. Print summary table to stdout
  console.log("=".repeat(120));
  console.log("  INDUSTRY DELTA ANALYSIS  (v1 Jan 2025 -> v4 Nov 2025)  --  Grouped by O*NET parentCluster");
  console.log("=".repeat(120));
  console.log();

  // Table header
  const hdr = [
    padRight("#", 3),
    padRight("Industry", 40),
    padLeft("Roles", 6),
    padLeft("Changed", 8),
    padLeft("Auto+", 6),
    padLeft("Auto-", 6),
    padLeft("Aug+", 6),
    padLeft("Aug-", 6),
    padLeft("Man+", 6),
    padLeft("Man-", 6),
    padLeft("|Abs|", 6),
    padRight("  Direction", 28),
  ].join(" ");

  console.log(hdr);
  console.log("-".repeat(120));

  for (let i = 0; i < industries.length; i++) {
    const ind = industries[i];
    const row = [
      padRight(String(i + 1), 3),
      padRight(ind.industry.slice(0, 40), 40),
      padLeft(String(ind.totalRoles), 6),
      padLeft(String(ind.rolesWithChanges), 8),
      padLeft(sign(ind.totalAutomationGained), 6),
      padLeft(String(ind.totalAutomationLost), 6),
      padLeft(sign(ind.totalAugmentationGained), 6),
      padLeft(String(ind.totalAugmentationLost), 6),
      padLeft(sign(ind.totalManualGained), 6),
      padLeft(String(ind.totalManualLost), 6),
      padLeft(String(ind.totalAbsoluteChange), 6),
      "  " + ind.netDirection,
    ].join(" ");
    console.log(row);
  }

  console.log("-".repeat(120));
  console.log();

  // 6. Print detailed breakdown for each industry
  console.log("=".repeat(120));
  console.log("  DETAILED BREAKDOWN PER INDUSTRY");
  console.log("=".repeat(120));

  for (let i = 0; i < industries.length; i++) {
    const ind = industries[i];
    console.log();
    console.log(`  ${i + 1}. ${ind.industry}`);
    console.log(`     Roles: ${ind.totalRoles} total, ${ind.rolesWithChanges} with changes`);
    console.log(
      `     Automation:   net ${sign(ind.netAutomationDelta)} (gained ${ind.totalAutomationGained}, lost ${ind.totalAutomationLost}) | avg/role: ${sign(ind.avgAutomationDelta)}`
    );
    console.log(
      `     Augmentation: net ${sign(ind.netAugmentationDelta)} (gained ${ind.totalAugmentationGained}, lost ${ind.totalAugmentationLost}) | avg/role: ${sign(ind.avgAugmentationDelta)}`
    );
    console.log(
      `     Manual:       net ${sign(ind.netManualDelta)} (gained ${ind.totalManualGained}, lost ${ind.totalManualLost})`
    );
    console.log(`     Direction:    ${ind.netDirection}`);

    if (ind.topChangedRoles.length > 0) {
      console.log(`     Top changed roles:`);
      for (const r of ind.topChangedRoles) {
        console.log(
          `       - [${r.code}] ${r.title}  (auto: ${sign(r.automationDelta)}, aug: ${sign(r.augmentationDelta)}, man: ${sign(r.manualDelta)}, |abs|: ${r.absTotalChange})`
        );
      }
    }
  }

  console.log();
  console.log("=".repeat(120));
  console.log("  DONE");
  console.log("=".repeat(120));
}

main();
