import onetDataJson from "@/data/onet/onetData.json" assert { type: "json" };
import onetRoleCodesJson from "@/data/onet/onetRoleCodes.json" assert { type: "json" };
// import onetCrosswalksJson from "@/data/onet/onetCrosswalks.json" assert { type: "json" };

const METRIC_KEYS = [
  "automation_pct",
  "augmentation_pct",
  "directive_pct",
  "feedback_loop_pct",
  "validation_pct",
  "task_iteration_pct",
  "learning_pct",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];

type MetricValue = Partial<Record<string, { global?: Record<string, number | undefined> }>>;

type OnetTaskNode = {
  cluster_name: string;
  variable?: MetricValue;
};

type OnetRoleNode = {
  cluster_name: string;
  variable?: MetricValue;
  children?: OnetTaskNode[];
};

type OnetSectorNode = {
  cluster_name: string;
  children?: OnetRoleNode[];
};

type OnetHierarchy = {
  onet_hierarchy?: OnetSectorNode[];
};

type RoleCodeMap = Record<string, { code: string; title: string } | undefined>;

export type CatalogTaskMetric = {
  name: string;
  normalizedWeight: number;
  count: number;
  automationShare: number;
  augmentationShare: number;
  manualShare: number;
  metrics: Partial<Record<MetricKey, number>> | null;
};

type CatalogMetrics = {
  automationCount: number;
  augmentationCount: number;
  manualCount: number;
  totalCount: number;
  coverage: number | null;
  taskCount: number;
  metrics: Partial<Record<MetricKey, number>> | null;
  automationTasks: number;
  augmentationTasks: number;
  manualTasks: number;
  tasks: CatalogTaskMetric[];
};

export interface OnetCatalogRole {
  code: string;
  title: string;
  normalizedTitle: string;
  parentCluster: string | null;
  metrics: CatalogMetrics;
}

const onetHierarchy: OnetHierarchy = onetDataJson as OnetHierarchy;
const roleCodes: RoleCodeMap = onetRoleCodesJson as RoleCodeMap;
// const crosswalks = onetCrosswalksJson as Array<{
//   code: string;
//   title: string;
//   normalizedTitle: string;
//   sourceTitles: string[];
// }>;

function normalizeRole(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function getGlobalMetric(node: { variable?: MetricValue }, key: string): number {
  const metric = node.variable?.[key];
  if (!metric?.global) return 0;
  const value = metric.global["GLOBAL"];
  return typeof value === "number" ? value : 0;
}

function round(value: number): number {
  return Number.parseFloat(value.toFixed(3));
}

function toShare(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value <= 1) {
    return value;
  }
  if (value <= 1000) {
    const scaled = value / 100;
    if (scaled <= 1) {
      return scaled;
    }
  }
  return 1;
}

function aggregateRoleMetrics(role: OnetRoleNode): CatalogMetrics {
  const workforceShare = getGlobalMetric(role, "pct");
  const tasks = role.children ?? [];

  if (tasks.length === 0 || workforceShare === 0) {
    return {
      automationCount: 0,
      augmentationCount: 0,
      manualCount: 0,
      totalCount: 0,
      coverage: tasks.length ? 0 : null,
      taskCount: tasks.length,
      metrics: null,
      automationTasks: 0,
      augmentationTasks: 0,
      manualTasks: tasks.length,
      tasks: [],
    };
  }

  let coverageAccumulator = 0;
  const totals: Record<MetricKey, number> = METRIC_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<MetricKey, number>
  );

  let automationCount = 0;
  let augmentationCount = 0;
  let totalCount = 0;
  let automationTasks = 0;
  let augmentationTasks = 0;
  let manualTasks = 0;
  const catalogTasks: CatalogTaskMetric[] = [];

  for (const task of tasks) {
    const taskWeight = getGlobalMetric(task, "pct");
    if (taskWeight > 0) {
      coverageAccumulator += taskWeight;
    }

    const autoShare = toShare(getGlobalMetric(task, "automation_pct"));
    const augShare = toShare(getGlobalMetric(task, "augmentation_pct"));
    const manualShare = Math.max(0, 1 - autoShare - augShare);

    const taskCount = getGlobalMetric(task, "count");
    if (taskCount > 0) {
      totalCount += taskCount;
      automationCount += taskCount * autoShare;
      augmentationCount += taskCount * augShare;

      if (autoShare <= 0 && augShare <= 0) {
        manualTasks += 1;
      } else if (autoShare >= augShare) {
        automationTasks += 1;
      } else {
        augmentationTasks += 1;
      }
    } else {
      if (autoShare <= 0 && augShare <= 0) {
        manualTasks += 1;
      } else if (autoShare >= augShare) {
        automationTasks += 1;
      } else {
        augmentationTasks += 1;
      }
    }

    const normalizedWeight = workforceShare > 0 && taskWeight > 0 ? taskWeight / workforceShare : 0;

    const taskMetrics = METRIC_KEYS.reduce((acc, key) => {
      const value = getGlobalMetric(task, key);
      if (value !== 0) {
        acc[key] = round(value);
      }
      return acc;
    }, {} as Partial<Record<MetricKey, number>>);

    catalogTasks.push({
      name: task.cluster_name,
      normalizedWeight,
      count: taskCount,
      automationShare: autoShare,
      augmentationShare: augShare,
      manualShare,
      metrics: Object.keys(taskMetrics).length > 0 ? taskMetrics : null,
    });

    if (normalizedWeight === 0) continue;

    for (const key of METRIC_KEYS) {
      const value = getGlobalMetric(task, key);
      if (value === 0) continue;
      totals[key] += value * normalizedWeight;
    }
  }

  const coverage = coverageAccumulator > 0 ? coverageAccumulator / workforceShare : 0;
  if (coverage === 0) {
    return {
      automationCount,
      augmentationCount,
      manualCount: Math.max(totalCount - automationCount - augmentationCount, 0),
      totalCount,
      coverage: 0,
      taskCount: tasks.length,
      metrics: null,
      automationTasks,
      augmentationTasks,
      manualTasks,
      tasks: catalogTasks,
    };
  }

  const metrics = METRIC_KEYS.reduce((acc, key) => {
    const total = totals[key];
    if (total > 0) {
      acc[key] = round(total);
    }
    return acc;
  }, {} as Partial<Record<MetricKey, number>>);

  return {
    automationCount,
    augmentationCount,
    manualCount: Math.max(totalCount - automationCount - augmentationCount, 0),
    totalCount,
    coverage,
    taskCount: tasks.length,
    metrics: Object.keys(metrics).length > 0 ? metrics : null,
    automationTasks,
    augmentationTasks,
    manualTasks,
    tasks: catalogTasks,
  };
}

let cachedCatalog: OnetCatalogRole[] | null = null;

export function loadOnetCatalog(): OnetCatalogRole[] {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const catalog: OnetCatalogRole[] = [];
  const sectors = onetHierarchy.onet_hierarchy ?? [];
  const byNormalizedTitle = new Map<string, OnetCatalogRole>();

  for (const sector of sectors) {
    const parentCluster = sector.cluster_name ?? null;

    for (const roleNode of sector.children ?? []) {
      const normalizedTitle = normalizeRole(roleNode.cluster_name);
      if (!normalizedTitle) continue;

      const codeEntry = roleCodes[normalizedTitle];
      if (!codeEntry?.code) {
        continue;
      }

      const role: OnetCatalogRole = {
        code: codeEntry.code,
        title: codeEntry.title ?? roleNode.cluster_name ?? codeEntry.code,
        normalizedTitle,
        parentCluster,
        metrics: aggregateRoleMetrics(roleNode),
      };

      catalog.push(role);
      byNormalizedTitle.set(normalizedTitle, role);
    }
  }

  // for (const alias of crosswalks) {
  //   if (catalog.some((role) => role.code === alias.code)) {
  //     continue;
  //   }

  //   const sources = alias.sourceTitles
  //     .map((title) => byNormalizedTitle.get(title))
  //     .filter((role): role is OnetCatalogRole => Boolean(role));

  //   if (sources.length === 0) {
  //     continue;
  //   }

  //   const metrics: Partial<Record<MetricKey, number>> = {};
  //   let automationCount = 0;
  //   let augmentationCount = 0;
  //   let totalCount = 0;
  //   let automationTasks = 0;
  //   let augmentationTasks = 0;
  //   let manualTasks = 0;

  //   for (const key of METRIC_KEYS) {
  //     const values = sources
  //       .map((role) => role.metrics.metrics?.[key] ?? null)
  //       .filter((value): value is number => value != null);

  //     if (!values.length) {
  //       continue;
  //     }

  //     const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  //     metrics[key] = round(average);
  //   }

  //   const coverages = sources
  //     .map((role) => role.metrics.coverage)
  //     .filter((value): value is number => value != null);
  //   const coverageAvg = coverages.length
  //     ? round(coverages.reduce((sum, value) => sum + value, 0) / coverages.length)
  //     : null;

  //   const taskCount = sources.reduce((sum, role) => sum + role.metrics.taskCount, 0);
  //   const parentCluster = sources.find((role) => role.parentCluster)?.parentCluster ?? null;

  //   for (const source of sources) {
  //     automationCount += source.metrics.automationCount;
  //     augmentationCount += source.metrics.augmentationCount;
  //     totalCount += source.metrics.totalCount;
  //     automationTasks += source.metrics.automationTasks;
  //     augmentationTasks += source.metrics.augmentationTasks;
  //     manualTasks += source.metrics.manualTasks;
  //   }

  //   const compositeRole: OnetCatalogRole = {
  //     code: alias.code,
  //     title: alias.title,
  //     normalizedTitle: alias.normalizedTitle,
  //     parentCluster,
  //     metrics: {
  //       automationCount,
  //       augmentationCount,
  //       manualCount: Math.max(totalCount - automationCount - augmentationCount, 0),
  //       totalCount,
  //       coverage: coverageAvg,
  //       taskCount,
  //       metrics: Object.keys(metrics).length > 0 ? metrics : null,
  //       automationTasks,
  //       augmentationTasks,
  //       manualTasks,
  //     },
  //   };

  //   catalog.push(compositeRole);
  //   byNormalizedTitle.set(alias.normalizedTitle, compositeRole);
  // }

  cachedCatalog = catalog;
  return catalog;
}

export function buildCodeLookup(catalog: OnetCatalogRole[]): Map<string, OnetCatalogRole> {
  const lookup = new Map<string, OnetCatalogRole>();

  for (const role of catalog) {
    lookup.set(role.code, role);
  }

  return lookup;
}

export function buildPrefixLookup(catalog: OnetCatalogRole[]): Map<string, OnetCatalogRole[]> {
  const lookup = new Map<string, OnetCatalogRole[]>();

  for (const role of catalog) {
    const prefix = role.code.split(".")[0];
    if (!lookup.has(prefix)) {
      lookup.set(prefix, []);
    }
    lookup.get(prefix)!.push(role);
  }

  for (const [key, roles] of lookup) {
    lookup.set(
      key,
      roles.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
    );
  }

  return lookup;
}
