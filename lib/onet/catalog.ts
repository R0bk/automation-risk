import onetDataJson from "@/data/onet/onetData.json" assert { type: "json" };
import onetDataV4Json from "@/data/onet/onetData-v4-2025-11.json" assert { type: "json" };
import onetRoleCodesJson from "@/data/onet/onetRoleCodes.json" assert { type: "json" };

const METRIC_KEYS = [
  "automation_pct",
  "augmentation_pct",
  "directive_pct",
  "feedback_loop_pct",
  "validation_pct",
  "task_iteration_pct",
  "learning_pct",
] as const;

/** New metric keys available in v4 (Nov 2025) data */
const V4_METRIC_KEYS = [
  "success_rate",
  "human_only_hours",
  "human_with_ai_hours",
  "education_years",
  "autonomy_level",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];
type V4MetricKey = (typeof V4_METRIC_KEYS)[number];

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
  /** v4: task success rate (0-1) */
  successRate?: number | null;
  /** v4: estimated human-only hours */
  humanOnlyHours?: number | null;
  /** v4: estimated hours with AI */
  humanWithAiHours?: number | null;
  /** v4: required education years */
  educationYears?: number | null;
  /** v4: AI autonomy level (1-5) */
  autonomyLevel?: number | null;
};

/** Snapshot of core metrics for a single data vintage, used for delta computation */
export type VintageSnapshot = {
  automationTasks: number;
  augmentationTasks: number;
  manualTasks: number;
  automationCount: number;
  augmentationCount: number;
  totalCount: number;
};

/** Delta between two data vintages (v4 - v1) */
export type CatalogDelta = {
  automationTasksDelta: number;
  augmentationTasksDelta: number;
  manualTasksDelta: number;
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
  /** v4: average success rate across tasks (0-1) */
  avgSuccessRate?: number | null;
  /** v4: average human-only hours */
  avgHumanOnlyHours?: number | null;
  /** v4: average education years */
  avgEducationYears?: number | null;
};

export interface OnetCatalogRole {
  code: string;
  title: string;
  normalizedTitle: string;
  parentCluster: string | null;
  metrics: CatalogMetrics;
  /** Metrics from the prior (v1, Jan 2025) data vintage for delta comparison */
  prior?: VintageSnapshot | null;
  /** Computed delta: current (v4) minus prior (v1) */
  delta?: CatalogDelta | null;
}

/** Primary data: v4 (Nov 2025) with updated metrics + new economic primitives */
const onetHierarchy: OnetHierarchy = onetDataV4Json as OnetHierarchy;
/** Prior data: v1 (Jan 2025) for delta computation */
const onetHierarchyPrior: OnetHierarchy = onetDataJson as OnetHierarchy;
const roleCodes: RoleCodeMap = onetRoleCodesJson as RoleCodeMap;

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

    // v4 economic primitives
    const successRate = getGlobalMetric(task, "success_rate") || null;
    const humanOnlyHours = getGlobalMetric(task, "human_only_hours") || null;
    const humanWithAiHours = getGlobalMetric(task, "human_with_ai_hours") || null;
    const educationYears = getGlobalMetric(task, "education_years") || null;
    const autonomyLevel = getGlobalMetric(task, "autonomy_level") || null;

    catalogTasks.push({
      name: task.cluster_name,
      normalizedWeight,
      count: taskCount,
      automationShare: autoShare,
      augmentationShare: augShare,
      manualShare,
      metrics: Object.keys(taskMetrics).length > 0 ? taskMetrics : null,
      successRate,
      humanOnlyHours,
      humanWithAiHours,
      educationYears,
      autonomyLevel,
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

  // v4: compute role-level averages from task primitives
  const tasksWithSuccess = catalogTasks.filter(t => t.successRate != null && t.successRate > 0);
  const avgSuccessRate = tasksWithSuccess.length > 0
    ? round(tasksWithSuccess.reduce((s, t) => s + (t.successRate ?? 0), 0) / tasksWithSuccess.length)
    : null;

  const tasksWithHours = catalogTasks.filter(t => t.humanOnlyHours != null && t.humanOnlyHours > 0);
  const avgHumanOnlyHours = tasksWithHours.length > 0
    ? round(tasksWithHours.reduce((s, t) => s + (t.humanOnlyHours ?? 0), 0) / tasksWithHours.length)
    : null;

  const tasksWithEdu = catalogTasks.filter(t => t.educationYears != null && t.educationYears > 0);
  const avgEducationYears = tasksWithEdu.length > 0
    ? round(tasksWithEdu.reduce((s, t) => s + (t.educationYears ?? 0), 0) / tasksWithEdu.length)
    : null;

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
    avgSuccessRate,
    avgHumanOnlyHours,
    avgEducationYears,
  };
}

let cachedCatalog: OnetCatalogRole[] | null = null;

/** Build a lookup of prior (v1) role metrics by normalized title */
function buildPriorLookup(): Map<string, VintageSnapshot> {
  const lookup = new Map<string, VintageSnapshot>();
  const sectors = onetHierarchyPrior.onet_hierarchy ?? [];
  for (const sector of sectors) {
    for (const roleNode of sector.children ?? []) {
      const normalizedTitle = normalizeRole(roleNode.cluster_name);
      if (!normalizedTitle) continue;
      const m = aggregateRoleMetrics(roleNode);
      lookup.set(normalizedTitle, {
        automationTasks: m.automationTasks,
        augmentationTasks: m.augmentationTasks,
        manualTasks: m.manualTasks,
        automationCount: m.automationCount,
        augmentationCount: m.augmentationCount,
        totalCount: m.totalCount,
      });
    }
  }
  return lookup;
}

export function loadOnetCatalog(): OnetCatalogRole[] {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const priorLookup = buildPriorLookup();

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

      const currentMetrics = aggregateRoleMetrics(roleNode);
      const prior = priorLookup.get(normalizedTitle) ?? null;

      const delta: CatalogDelta | null = prior ? {
        automationTasksDelta: currentMetrics.automationTasks - prior.automationTasks,
        augmentationTasksDelta: currentMetrics.augmentationTasks - prior.augmentationTasks,
        manualTasksDelta: currentMetrics.manualTasks - prior.manualTasks,
      } : null;

      const role: OnetCatalogRole = {
        code: codeEntry.code,
        title: codeEntry.title ?? roleNode.cluster_name ?? codeEntry.code,
        normalizedTitle,
        parentCluster,
        metrics: currentMetrics,
        prior,
        delta,
      };

      catalog.push(role);
      byNormalizedTitle.set(normalizedTitle, role);
    }
  }

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

export type TopMover = {
  code: string;
  title: string;
  parentCluster: string | null;
  automationTasksBefore: number;
  automationTasksAfter: number;
  augmentationTasksBefore: number;
  augmentationTasksAfter: number;
  automationDelta: number;
  augmentationDelta: number;
  avgSuccessRate: number | null;
};

/** Get the roles with the biggest automation increase between v1 → v4 */
export function getTopMovers(catalog: OnetCatalogRole[], limit = 20): TopMover[] {
  return catalog
    .filter(r => r.delta != null && r.prior != null)
    .map(r => ({
      code: r.code,
      title: r.title,
      parentCluster: r.parentCluster,
      automationTasksBefore: r.prior!.automationTasks,
      automationTasksAfter: r.metrics.automationTasks,
      augmentationTasksBefore: r.prior!.augmentationTasks,
      augmentationTasksAfter: r.metrics.augmentationTasks,
      automationDelta: r.delta!.automationTasksDelta,
      augmentationDelta: r.delta!.augmentationTasksDelta,
      avgSuccessRate: r.metrics.avgSuccessRate ?? null,
    }))
    .sort((a, b) => Math.abs(b.automationDelta) - Math.abs(a.automationDelta))
    .slice(0, limit);
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
