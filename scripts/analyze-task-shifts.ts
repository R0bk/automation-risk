/**
 * analyze-task-shifts.ts
 *
 * Deep TASK-LEVEL analysis of v1 -> v4 classification changes.
 *
 * For every task in every role, determines whether it was classified as
 * "automation", "augmentation", or "manual" in v1 and v4, then tracks
 * all category transitions and reports the most common shifting tasks.
 *
 * Output: /tmp/task-shifts-analysis.json + console summary
 */

import * as fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Variable {
  automation_pct?: { global?: { GLOBAL?: number } };
  augmentation_pct?: { global?: { GLOBAL?: number } };
  [key: string]: unknown;
}

interface TaskNode {
  level: number;
  cluster_name: string;
  variable: Variable;
  children?: TaskNode[];
}

interface RoleNode {
  level: number;
  cluster_name: string;
  variable: Variable;
  children: TaskNode[];
}

interface SectorNode {
  level: number;
  cluster_name: string;
  variable: Variable;
  children: RoleNode[];
}

interface OnetData {
  onet_hierarchy: Record<string, SectorNode>;
}

type Category = "automation" | "augmentation" | "manual";

interface TaskInfo {
  taskName: string;
  roleName: string;
  sectorName: string;
  automationPct: number;
  augmentationPct: number;
  category: Category;
}

interface TransitionRecord {
  taskName: string;
  roleName: string;
  sectorName: string;
  v1Auto: number;
  v1Aug: number;
  v4Auto: number;
  v4Aug: number;
  v1Category: Category;
  v4Category: Category;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a percentage value to 0-1 share */
function toShare(value: number): number {
  if (value <= 1) return value;
  if (value <= 100) return value / 100;
  return value / 100; // fallback
}

/** Extract the automation_pct and augmentation_pct from a task variable */
function extractPcts(variable: Variable): {
  automationPct: number;
  augmentationPct: number;
} {
  const rawAuto = variable?.automation_pct?.global?.GLOBAL ?? 0;
  const rawAug = variable?.augmentation_pct?.global?.GLOBAL ?? 0;
  return {
    automationPct: toShare(rawAuto),
    augmentationPct: toShare(rawAug),
  };
}

/** Classify a task based on its automation and augmentation percentages (already as shares 0-1) */
function classify(automationPct: number, augmentationPct: number): Category {
  const THRESHOLD = 0.005; // 0.5% threshold for "negligible"
  const isNegligible =
    automationPct < THRESHOLD && augmentationPct < THRESHOLD;
  if (isNegligible) return "manual";
  if (automationPct > augmentationPct) return "automation";
  if (augmentationPct > automationPct) return "augmentation";
  // Tie -- default to augmentation (human-in-the-loop)
  return "augmentation";
}

/** Build a map of (roleName + "|||" + taskName) -> TaskInfo from an onet dataset */
function buildTaskMap(data: OnetData): Map<string, TaskInfo> {
  const map = new Map<string, TaskInfo>();
  const hierarchy = data.onet_hierarchy;

  for (const sectorKey of Object.keys(hierarchy)) {
    const sector = hierarchy[sectorKey];
    const sectorName = sector.cluster_name;

    for (const role of sector.children) {
      const roleName = role.cluster_name;

      // role.children might be an array or array-like object
      const tasks = role.children;
      const taskKeys = Object.keys(tasks);

      for (const tk of taskKeys) {
        const task = (tasks as any)[tk] as TaskNode;
        if (!task || task.level !== 0) continue;

        const taskName = task.cluster_name;
        const { automationPct, augmentationPct } = extractPcts(task.variable);
        const category = classify(automationPct, augmentationPct);

        const key = `${roleName}|||${taskName}`;
        map.set(key, {
          taskName,
          roleName,
          sectorName,
          automationPct,
          augmentationPct,
          category,
        });
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("Loading V1 data...");
  const v1Raw: OnetData = JSON.parse(
    fs.readFileSync(
      "/home/user/automation-risk/data/onet/onetData.json",
      "utf-8",
    ),
  );

  console.log("Loading V4 data...");
  const v4Raw: OnetData = JSON.parse(
    fs.readFileSync(
      "/home/user/automation-risk/data/onet/onetData-v4-2025-11.json",
      "utf-8",
    ),
  );

  console.log("Building task maps...");
  const v1Map = buildTaskMap(v1Raw);
  const v4Map = buildTaskMap(v4Raw);

  console.log(`V1 tasks: ${v1Map.size}`);
  console.log(`V4 tasks: ${v4Map.size}`);

  // Collect all unique keys present in both versions
  const allKeys = new Set<string>([...v1Map.keys(), ...v4Map.keys()]);
  console.log(`Unique task-role combinations: ${allKeys.size}`);

  // ---------------------------------------------------------------------------
  // Track transitions
  // ---------------------------------------------------------------------------

  const transitions: Record<string, TransitionRecord[]> = {
    "manual->automation": [],
    "manual->augmentation": [],
    "automation->augmentation": [],
    "augmentation->automation": [],
    "automation->manual": [],
    "augmentation->manual": [],
    unchanged: [],
    new_in_v4: [],
    removed_in_v4: [],
  };

  // Also track task-name-level frequency of transitions (across roles)
  const taskNameTransitionCount: Record<
    string,
    { total: number; byType: Record<string, number> }
  > = {};

  const transitionTypes = [
    "manual->automation",
    "manual->augmentation",
    "automation->augmentation",
    "augmentation->automation",
    "automation->manual",
    "augmentation->manual",
  ];

  for (const key of allKeys) {
    const v1 = v1Map.get(key);
    const v4 = v4Map.get(key);

    // Parse key
    const sepIdx = key.indexOf("|||");
    const roleName = key.substring(0, sepIdx);
    const taskName = key.substring(sepIdx + 3);

    if (!v1 && v4) {
      transitions["new_in_v4"].push({
        taskName: v4.taskName,
        roleName: v4.roleName,
        sectorName: v4.sectorName,
        v1Auto: 0,
        v1Aug: 0,
        v4Auto: v4.automationPct,
        v4Aug: v4.augmentationPct,
        v1Category: "manual",
        v4Category: v4.category,
      });
      continue;
    }

    if (v1 && !v4) {
      transitions["removed_in_v4"].push({
        taskName: v1.taskName,
        roleName: v1.roleName,
        sectorName: v1.sectorName,
        v1Auto: v1.automationPct,
        v1Aug: v1.augmentationPct,
        v4Auto: 0,
        v4Aug: 0,
        v1Category: v1.category,
        v4Category: "manual",
      });
      continue;
    }

    if (!v1 || !v4) continue;

    const v1Cat = v1.category;
    const v4Cat = v4.category;

    const record: TransitionRecord = {
      taskName: v1.taskName,
      roleName: v1.roleName,
      sectorName: v1.sectorName,
      v1Auto: v1.automationPct,
      v1Aug: v1.augmentationPct,
      v4Auto: v4.automationPct,
      v4Aug: v4.augmentationPct,
      v1Category: v1Cat,
      v4Category: v4Cat,
    };

    if (v1Cat === v4Cat) {
      transitions["unchanged"].push(record);
    } else {
      const transType = `${v1Cat}->${v4Cat}`;
      if (transitions[transType]) {
        transitions[transType].push(record);
      }

      // Track by task name
      if (!taskNameTransitionCount[taskName]) {
        taskNameTransitionCount[taskName] = { total: 0, byType: {} };
      }
      taskNameTransitionCount[taskName].total += 1;
      taskNameTransitionCount[taskName].byType[transType] =
        (taskNameTransitionCount[taskName].byType[transType] || 0) + 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Category distribution summaries
  // ---------------------------------------------------------------------------

  function categoryDistribution(map: Map<string, TaskInfo>) {
    const dist = { automation: 0, augmentation: 0, manual: 0 };
    for (const info of map.values()) {
      dist[info.category]++;
    }
    return dist;
  }

  const v1Dist = categoryDistribution(v1Map);
  const v4Dist = categoryDistribution(v4Map);

  // ---------------------------------------------------------------------------
  // Aggregate task names by transition type (top 20 most common names)
  // ---------------------------------------------------------------------------

  function topTaskNames(
    records: TransitionRecord[],
    topN: number = 20,
  ): { taskName: string; count: number; examples: string[] }[] {
    const nameCounts: Record<string, { count: number; roles: string[] }> = {};
    for (const r of records) {
      if (!nameCounts[r.taskName]) {
        nameCounts[r.taskName] = { count: 0, roles: [] };
      }
      nameCounts[r.taskName].count += 1;
      if (nameCounts[r.taskName].roles.length < 3) {
        nameCounts[r.taskName].roles.push(r.roleName);
      }
    }
    return Object.entries(nameCounts)
      .map(([taskName, data]) => ({
        taskName,
        count: data.count,
        examples: data.roles,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }

  // ---------------------------------------------------------------------------
  // Build per-transition-type summaries
  // ---------------------------------------------------------------------------

  const transitionSummaries: Record<
    string,
    {
      count: number;
      topTasks: { taskName: string; count: number; examples: string[] }[];
      sample: TransitionRecord[];
    }
  > = {};

  for (const tt of transitionTypes) {
    const records = transitions[tt];
    transitionSummaries[tt] = {
      count: records.length,
      topTasks: topTaskNames(records, 20),
      sample: records.slice(0, 5),
    };
  }

  // ---------------------------------------------------------------------------
  // Top task names with most transitions overall
  // ---------------------------------------------------------------------------

  const topOverallTaskNames = Object.entries(taskNameTransitionCount)
    .map(([taskName, data]) => ({
      taskName,
      totalTransitions: data.total,
      byType: data.byType,
    }))
    .sort((a, b) => b.totalTransitions - a.totalTransitions)
    .slice(0, 50);

  // ---------------------------------------------------------------------------
  // Magnitude of shifts -- tasks with biggest category changes
  // ---------------------------------------------------------------------------

  const biggestShifts = [...allKeys]
    .filter((k) => v1Map.has(k) && v4Map.has(k))
    .map((k) => {
      const v1 = v1Map.get(k)!;
      const v4 = v4Map.get(k)!;
      const autoDelta = v4.automationPct - v1.automationPct;
      const augDelta = v4.augmentationPct - v1.augmentationPct;
      return {
        taskName: v1.taskName,
        roleName: v1.roleName,
        v1Auto: v1.automationPct,
        v1Aug: v1.augmentationPct,
        v4Auto: v4.automationPct,
        v4Aug: v4.augmentationPct,
        v1Category: v1.category,
        v4Category: v4.category,
        autoDelta,
        augDelta,
        totalAbsDelta: Math.abs(autoDelta) + Math.abs(augDelta),
      };
    })
    .filter((r) => r.v1Category !== r.v4Category)
    .sort((a, b) => b.totalAbsDelta - a.totalAbsDelta)
    .slice(0, 50);

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  const output = {
    summary: {
      v1TaskCount: v1Map.size,
      v4TaskCount: v4Map.size,
      uniqueTaskRoleCombinations: allKeys.size,
      v1CategoryDistribution: v1Dist,
      v4CategoryDistribution: v4Dist,
      transitionCounts: Object.fromEntries(
        Object.entries(transitions).map(([k, v]) => [k, v.length]),
      ),
      totalCategoryChanges: transitionTypes.reduce(
        (sum, tt) => sum + transitions[tt].length,
        0,
      ),
    },
    transitionDetails: transitionSummaries,
    topOverallShiftingTasks: topOverallTaskNames,
    biggestMagnitudeShifts: biggestShifts,
    metaInfo: {
      newInV4: transitions["new_in_v4"].length,
      removedInV4: transitions["removed_in_v4"].length,
      unchanged: transitions["unchanged"].length,
    },
  };

  // Write JSON
  const outPath = "/tmp/task-shifts-analysis.json";
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nFull analysis written to: ${outPath}`);

  // ---------------------------------------------------------------------------
  // Console summary
  // ---------------------------------------------------------------------------

  console.log("\n" + "=".repeat(80));
  console.log("TASK-LEVEL CLASSIFICATION SHIFT ANALYSIS: V1 -> V4");
  console.log("=".repeat(80));

  console.log(`\n--- Dataset sizes ---`);
  console.log(`  V1 task-role pairs: ${v1Map.size}`);
  console.log(`  V4 task-role pairs: ${v4Map.size}`);
  console.log(`  Unique combinations: ${allKeys.size}`);
  console.log(`  New in V4 (not in V1): ${transitions["new_in_v4"].length}`);
  console.log(
    `  Removed in V4 (not in V4): ${transitions["removed_in_v4"].length}`,
  );

  console.log(`\n--- Category distributions ---`);
  console.log(
    `  V1:  automation=${v1Dist.automation}  augmentation=${v1Dist.augmentation}  manual=${v1Dist.manual}`,
  );
  console.log(
    `  V4:  automation=${v4Dist.automation}  augmentation=${v4Dist.augmentation}  manual=${v4Dist.manual}`,
  );

  console.log(
    `\n--- Transition counts (tasks present in BOTH v1 and v4) ---`,
  );
  for (const tt of transitionTypes) {
    const count = transitions[tt].length;
    const pct =
      allKeys.size > 0 ? ((count / allKeys.size) * 100).toFixed(2) : "0";
    console.log(
      `  ${tt.padEnd(30)} : ${count.toString().padStart(6)}  (${pct}%)`,
    );
  }
  console.log(
    `  ${"unchanged".padEnd(30)} : ${transitions["unchanged"].length.toString().padStart(6)}`,
  );

  console.log(`\n--- Top tasks by transition type ---`);
  for (const tt of transitionTypes) {
    const summary = transitionSummaries[tt];
    if (summary.count === 0) continue;
    console.log(`\n  [${tt}] -- ${summary.count} total transitions`);
    for (const t of summary.topTasks.slice(0, 10)) {
      console.log(
        `    ${t.count.toString().padStart(4)}x  "${t.taskName.substring(0, 80)}"`,
      );
      console.log(
        `           roles: ${t.examples.map((r: string) => r.substring(0, 40)).join(", ")}`,
      );
    }
  }

  console.log(
    `\n--- Top 30 task NAMES with most transitions overall ---`,
  );
  for (const t of topOverallTaskNames.slice(0, 30)) {
    const types = Object.entries(t.byType)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    console.log(
      `  ${t.totalTransitions.toString().padStart(4)}x  "${t.taskName.substring(0, 75)}"`,
    );
    console.log(`         [${types}]`);
  }

  console.log(`\n--- Top 20 biggest magnitude shifts ---`);
  for (const s of biggestShifts.slice(0, 20)) {
    console.log(
      `  "${s.taskName.substring(0, 60)}" (${s.roleName.substring(0, 35)})`,
    );
    console.log(
      `    ${s.v1Category} -> ${s.v4Category}  |  auto: ${(s.v1Auto * 100).toFixed(1)}% -> ${(s.v4Auto * 100).toFixed(1)}%  |  aug: ${(s.v1Aug * 100).toFixed(1)}% -> ${(s.v4Aug * 100).toFixed(1)}%`,
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("Analysis complete.");
}

main();
