import { loadOnetCatalog, getTopMovers } from "@/lib/onet/catalog";
import type { OnetCatalogRole } from "@/lib/onet/catalog";
import { writeFileSync } from "node:fs";

function main() {
  // 1. Load catalog
  const catalog = loadOnetCatalog();
  console.log(`Loaded ${catalog.length} total roles from O*NET catalog.\n`);

  // 2. Filter roles that have delta information
  const rolesWithDeltas = catalog.filter(
    (r): r is OnetCatalogRole & { delta: NonNullable<OnetCatalogRole["delta"]>; prior: NonNullable<OnetCatalogRole["prior"]> } =>
      r.delta != null && r.prior != null
  );

  console.log(`Roles with v1->v4 delta information: ${rolesWithDeltas.length}\n`);

  // 3. Build detailed role info and sort by absolute total change
  const roleDetails = rolesWithDeltas.map((r) => {
    const absTotalChange =
      Math.abs(r.delta.automationTasksDelta) +
      Math.abs(r.delta.augmentationTasksDelta) +
      Math.abs(r.delta.manualTasksDelta);

    return {
      code: r.code,
      title: r.title,
      parentCluster: r.parentCluster,
      v4TaskCounts: {
        automationTasks: r.metrics.automationTasks,
        augmentationTasks: r.metrics.augmentationTasks,
        manualTasks: r.metrics.manualTasks,
        totalTasks: r.metrics.taskCount,
      },
      v1TaskCounts: {
        automationTasks: r.prior.automationTasks,
        augmentationTasks: r.prior.augmentationTasks,
        manualTasks: r.prior.manualTasks,
      },
      delta: {
        automationTasksDelta: r.delta.automationTasksDelta,
        augmentationTasksDelta: r.delta.augmentationTasksDelta,
        manualTasksDelta: r.delta.manualTasksDelta,
      },
      absTotalChange,
    };
  });

  // Sort by absolute total change descending
  roleDetails.sort((a, b) => b.absTotalChange - a.absTotalChange);

  // 4. Compute summary statistics
  const totalRoles = catalog.length;
  const rolesWithDeltaCount = rolesWithDeltas.length;

  // Average deltas
  const avgAutomationDelta =
    rolesWithDeltas.reduce((sum, r) => sum + r.delta.automationTasksDelta, 0) / rolesWithDeltaCount;
  const avgAugmentationDelta =
    rolesWithDeltas.reduce((sum, r) => sum + r.delta.augmentationTasksDelta, 0) / rolesWithDeltaCount;
  const avgManualDelta =
    rolesWithDeltas.reduce((sum, r) => sum + r.delta.manualTasksDelta, 0) / rolesWithDeltaCount;

  // Distribution counts
  let gainedAutomation = 0;
  let lostAutomation = 0;
  let noChangeAutomation = 0;
  let gainedAugmentation = 0;
  let lostAugmentation = 0;
  let noChangeAugmentation = 0;
  let gainedManual = 0;
  let lostManual = 0;
  let noChangeManual = 0;
  let noChangeAtAll = 0;

  for (const r of rolesWithDeltas) {
    if (r.delta.automationTasksDelta > 0) gainedAutomation++;
    else if (r.delta.automationTasksDelta < 0) lostAutomation++;
    else noChangeAutomation++;

    if (r.delta.augmentationTasksDelta > 0) gainedAugmentation++;
    else if (r.delta.augmentationTasksDelta < 0) lostAugmentation++;
    else noChangeAugmentation++;

    if (r.delta.manualTasksDelta > 0) gainedManual++;
    else if (r.delta.manualTasksDelta < 0) lostManual++;
    else noChangeManual++;

    if (
      r.delta.automationTasksDelta === 0 &&
      r.delta.augmentationTasksDelta === 0 &&
      r.delta.manualTasksDelta === 0
    ) {
      noChangeAtAll++;
    }
  }

  // 5. Also get top movers via the library function
  const topMovers = getTopMovers(catalog, 20);

  const summary = {
    totalRoles,
    rolesWithDeltas: rolesWithDeltaCount,
    rolesWithoutDeltas: totalRoles - rolesWithDeltaCount,
    rolesWithNoChangeAtAll: noChangeAtAll,
    averageDeltas: {
      automationTasksDelta: Number(avgAutomationDelta.toFixed(3)),
      augmentationTasksDelta: Number(avgAugmentationDelta.toFixed(3)),
      manualTasksDelta: Number(avgManualDelta.toFixed(3)),
    },
    distribution: {
      automation: {
        gained: gainedAutomation,
        lost: lostAutomation,
        noChange: noChangeAutomation,
      },
      augmentation: {
        gained: gainedAugmentation,
        lost: lostAugmentation,
        noChange: noChangeAugmentation,
      },
      manual: {
        gained: gainedManual,
        lost: lostManual,
        noChange: noChangeManual,
      },
    },
  };

  // Build full JSON output
  const output = {
    generatedAt: new Date().toISOString(),
    summary,
    topMovers,
    allRolesWithDeltas: roleDetails,
  };

  // Write structured JSON
  writeFileSync("/tmp/catalog-deltas-analysis.json", JSON.stringify(output, null, 2), "utf-8");
  console.log("Structured output written to /tmp/catalog-deltas-analysis.json\n");

  // Print human-readable summary to stdout
  console.log("=".repeat(80));
  console.log("  O*NET CATALOG DELTA ANALYSIS (v1 Jan 2025 -> v4 Nov 2025)");
  console.log("=".repeat(80));
  console.log();
  console.log(`  Total roles in catalog:        ${totalRoles}`);
  console.log(`  Roles with delta info:         ${rolesWithDeltaCount}`);
  console.log(`  Roles without delta info:      ${totalRoles - rolesWithDeltaCount}`);
  console.log(`  Roles with zero change:        ${noChangeAtAll}`);
  console.log();
  console.log("-".repeat(80));
  console.log("  AVERAGE DELTAS (across all roles with delta info)");
  console.log("-".repeat(80));
  console.log(`  Avg automation tasks delta:    ${avgAutomationDelta.toFixed(3)}`);
  console.log(`  Avg augmentation tasks delta:  ${avgAugmentationDelta.toFixed(3)}`);
  console.log(`  Avg manual tasks delta:        ${avgManualDelta.toFixed(3)}`);
  console.log();
  console.log("-".repeat(80));
  console.log("  DISTRIBUTION OF CHANGES");
  console.log("-".repeat(80));
  console.log(`  Automation tasks:`);
  console.log(`    Gained:    ${gainedAutomation} roles`);
  console.log(`    Lost:      ${lostAutomation} roles`);
  console.log(`    No change: ${noChangeAutomation} roles`);
  console.log(`  Augmentation tasks:`);
  console.log(`    Gained:    ${gainedAugmentation} roles`);
  console.log(`    Lost:      ${lostAugmentation} roles`);
  console.log(`    No change: ${noChangeAugmentation} roles`);
  console.log(`  Manual tasks:`);
  console.log(`    Gained:    ${gainedManual} roles`);
  console.log(`    Lost:      ${lostManual} roles`);
  console.log(`    No change: ${noChangeManual} roles`);
  console.log();
  console.log("-".repeat(80));
  console.log("  TOP 20 BIGGEST MOVERS (by absolute total change)");
  console.log("-".repeat(80));
  console.log();

  const top20 = roleDetails.slice(0, 20);
  for (let i = 0; i < top20.length; i++) {
    const r = top20[i];
    console.log(`  ${String(i + 1).padStart(2)}. [${r.code}] ${r.title}`);
    console.log(`      Cluster: ${r.parentCluster ?? "N/A"}`);
    console.log(
      `      v4 tasks: auto=${r.v4TaskCounts.automationTasks}, aug=${r.v4TaskCounts.augmentationTasks}, manual=${r.v4TaskCounts.manualTasks}, total=${r.v4TaskCounts.totalTasks}`
    );
    console.log(
      `      v1 tasks: auto=${r.v1TaskCounts.automationTasks}, aug=${r.v1TaskCounts.augmentationTasks}, manual=${r.v1TaskCounts.manualTasks}`
    );
    console.log(
      `      Deltas:   auto=${r.delta.automationTasksDelta > 0 ? "+" : ""}${r.delta.automationTasksDelta}, aug=${r.delta.augmentationTasksDelta > 0 ? "+" : ""}${r.delta.augmentationTasksDelta}, manual=${r.delta.manualTasksDelta > 0 ? "+" : ""}${r.delta.manualTasksDelta}`
    );
    console.log(`      Abs total change: ${r.absTotalChange}`);
    console.log();
  }

  console.log("-".repeat(80));
  console.log(`  TOP MOVERS (via getTopMovers library function, by automation delta)`);
  console.log("-".repeat(80));
  console.log();
  for (let i = 0; i < topMovers.length; i++) {
    const m = topMovers[i];
    console.log(
      `  ${String(i + 1).padStart(2)}. [${m.code}] ${m.title} | auto: ${m.automationTasksBefore}->${m.automationTasksAfter} (${m.automationDelta > 0 ? "+" : ""}${m.automationDelta}) | aug: ${m.augmentationTasksBefore}->${m.augmentationTasksAfter} (${m.augmentationDelta > 0 ? "+" : ""}${m.augmentationDelta}) | successRate: ${m.avgSuccessRate ?? "N/A"}`
    );
  }

  console.log();
  console.log("=".repeat(80));
  console.log("  DONE");
  console.log("=".repeat(80));
}

main();
