import type { EnrichedOrgRole } from "./report-schema";
import type { TaskMixCounts, TaskMixShares } from "@/lib/constants/task-mix";
import {
  buildCodeLookup,
  loadOnetCatalog,
  type OnetCatalogRole,
} from "@/lib/onet/catalog";

const DEFAULT_COUNTS: TaskMixCounts = { automation: 0, augmentation: 0, manual: 0 };
const DEFAULT_SHARES: TaskMixShares = {
  automation: null,
  augmentation: null,
  manual: null,
};

const USAGE_SEGMENT_TOTAL = 100;

function classifyTask(automation?: number | null, augmentation?: number | null): keyof TaskMixCounts {
  const auto = typeof automation === "number" ? automation : 0;
  const aug = typeof augmentation === "number" ? augmentation : 0;

  if (auto <= 0 && aug <= 0) {
    return "manual";
  }

  return auto >= aug ? "automation" : "augmentation";
}

let cachedLookup: Map<string, OnetCatalogRole> | null = null;
let cachedNormalizedLookup: Map<string, OnetCatalogRole> | null = null;

function getCatalogRole(role: EnrichedOrgRole): OnetCatalogRole | null {
  if (!cachedLookup) {
    try {
      const catalog = loadOnetCatalog();
      cachedLookup = buildCodeLookup(catalog);
      cachedNormalizedLookup = new Map(
        catalog.map((catalogRole) => [catalogRole.normalizedTitle, catalogRole])
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("task-mix: failed to load catalog", error);
      }
      cachedLookup = new Map();
      cachedNormalizedLookup = new Map();
    }
  }

  const code = role.onetCode?.trim();
  if (code && cachedLookup?.has(code)) {
    return cachedLookup.get(code) ?? null;
  }

  const normalized = role.normalizedTitle?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return cachedNormalizedLookup?.get(normalized) ?? null;
}

export function deriveTaskMixCounts(role: EnrichedOrgRole | undefined | null): TaskMixCounts {
  if (!role) {
    return DEFAULT_COUNTS;
  }

  if (role.taskMixCounts) {
    return {
      automation: Math.max(0, role.taskMixCounts.automation ?? 0),
      augmentation: Math.max(0, role.taskMixCounts.augmentation ?? 0),
      manual: Math.max(0, role.taskMixCounts.manual ?? 0),
    };
  }

  const tasks = role.topTasks ?? [];
  if (tasks.length === 0) {
    const catalogRole = getCatalogRole(role);
    if (catalogRole) {
      const {
        automationTasks = 0,
        augmentationTasks = 0,
        manualTasks = 0,
        taskCount = 0,
      } = catalogRole.metrics;

      const counts: TaskMixCounts = {
        automation: Math.max(0, Math.round(automationTasks ?? 0)),
        augmentation: Math.max(0, Math.round(augmentationTasks ?? 0)),
        manual: Math.max(0, Math.round(manualTasks ?? 0)),
      };

      if (
        counts.automation === 0 &&
        counts.augmentation === 0 &&
        counts.manual === 0 &&
        taskCount > 0
      ) {
        const equalShare = Math.max(1, Math.round(taskCount / 3));
        counts.automation = equalShare;
        counts.augmentation = equalShare;
        counts.manual = Math.max(0, taskCount - equalShare * 2);
      }

      if (process.env.NODE_ENV !== "production") {
        console.debug("task-mix: using catalog fallback", {
          title: role.title,
          onetCode: role.onetCode,
          counts,
        });
      }

      return counts;
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("task-mix: role missing tasks", {
        title: role.title,
        onetCode: role.onetCode,
        topTasks: role.topTasks,
      });
    }
    return DEFAULT_COUNTS;
  }

  const counts = tasks.reduce<TaskMixCounts>((acc, task) => {
    const bucket = classifyTask(task.automation, task.augmentation);
    acc[bucket] += 1;
    return acc;
  }, { automation: 0, augmentation: 0, manual: 0 });

  if (process.env.NODE_ENV !== "production") {
    const total = counts.automation + counts.augmentation + counts.manual;
    if (total === 0) {
      console.debug("task-mix: zero totals despite tasks", {
        title: role.title,
        onetCode: role.onetCode,
        topTasks: role.topTasks,
      });
    }
  }

  return counts;
}

export function deriveTaskMixShares(role: EnrichedOrgRole | undefined | null): TaskMixShares {
  if (!role) {
    return DEFAULT_SHARES;
  }

  if (role.taskMixShares) {
    return {
      automation: role.taskMixShares.automation ?? null,
      augmentation: role.taskMixShares.augmentation ?? null,
      manual: role.taskMixShares.manual ?? null,
    };
  }

  const catalogRole = getCatalogRole(role);
  if (catalogRole) {
    const { automationCount = 0, augmentationCount = 0, manualCount = 0, totalCount = 0 } = catalogRole.metrics;
    if (totalCount > 0) {
      const automation = automationCount / totalCount;
      const augmentation = augmentationCount / totalCount;
      const manual = Math.max(0, 1 - automation - augmentation);
      return {
        automation,
        augmentation,
        manual,
      };
    }
  }

  const hasShares = typeof role.automationShare === "number" || typeof role.augmentationShare === "number";
  if (hasShares) {
    const auto = typeof role.automationShare === "number" ? role.automationShare : null;
    const aug = typeof role.augmentationShare === "number" ? role.augmentationShare : null;
    const manual = auto != null || aug != null ? Math.max(0, 1 - (auto ?? 0) - (aug ?? 0)) : null;
    return {
      automation: auto,
      augmentation: aug,
      manual,
    };
  }

  return DEFAULT_SHARES;
}

export type TaskMixView = "coverage" | "usage";

function normalizeSharesToCounts(shares: TaskMixShares, totalSegments: number): TaskMixCounts {
  const auto = shares.automation ?? 0;
  const aug = shares.augmentation ?? 0;
  const manualShare = shares.manual ?? Math.max(0, 1 - auto - aug);

  const raw = [
    { key: "automation" as const, value: auto * totalSegments },
    { key: "augmentation" as const, value: aug * totalSegments },
    { key: "manual" as const, value: manualShare * totalSegments },
  ];

  const rounded: Record<keyof TaskMixCounts, number> = {
    automation: 0,
    augmentation: 0,
    manual: 0,
  };

  let accumulated = 0;
  const fractional: Array<{ key: keyof TaskMixCounts; fraction: number }> = [];

  for (const entry of raw) {
    const roundedValue = Math.floor(entry.value);
    rounded[entry.key] = roundedValue;
    accumulated += roundedValue;
    fractional.push({ key: entry.key, fraction: entry.value - roundedValue });
  }

  let remainder = Math.max(0, totalSegments - accumulated);
  fractional.sort((a, b) => b.fraction - a.fraction);
  for (const entry of fractional) {
    if (remainder <= 0) break;
    rounded[entry.key] += 1;
    remainder -= 1;
  }

  return {
    automation: rounded.automation,
    augmentation: rounded.augmentation,
    manual: rounded.manual,
  };
}

export function deriveTaskMixForView(
  role: EnrichedOrgRole | undefined | null,
  view: TaskMixView
): TaskMixCounts {
  if (view === "coverage") {
    return deriveTaskMixCounts(role);
  }

  const shares = deriveTaskMixShares(role);
  if (shares.automation == null && shares.augmentation == null && shares.manual == null) {
    return DEFAULT_COUNTS;
  }

  return normalizeSharesToCounts(shares, USAGE_SEGMENT_TOTAL);
}
