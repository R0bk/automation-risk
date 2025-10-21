import { tool } from "ai";
import { z } from "zod";

import onetData from "@/data/onet/onetData.json" assert { type: "json" };
import onetRoleCodes from "@/data/onet/onetRoleCodes.json" assert { type: "json" };

const METRIC_KEYS = [
  "automation_pct",
  "augmentation_pct",
  "directive_pct",
  "feedback_loop_pct",
  "validation_pct",
  "task_iteration_pct",
  "learning_pct",
] as const;

const METRIC_LABELS: Record<(typeof METRIC_KEYS)[number], string> = {
  automation_pct: "Automation",
  augmentation_pct: "Augmentation",
  directive_pct: "Directive",
  feedback_loop_pct: "Feedback",
  validation_pct: "Validation",
  task_iteration_pct: "Task Iteration",
  learning_pct: "Learning",
};

const AUTOMATION_KEYS = ["automation_pct", "directive_pct", "feedback_loop_pct"] as const;
const AUGMENTATION_KEYS = ["augmentation_pct", "task_iteration_pct", "validation_pct", "learning_pct"] as const;

type MetricKey = (typeof METRIC_KEYS)[number];

type GlobalMetric = {
  global?: Record<string, number | undefined> | undefined;
};

type OnetNode = {
  level: number;
  cluster_name: string;
  variable: Partial<Record<string, GlobalMetric>>;
  children?: OnetNode[];
};

type OnetHierarchy = {
  onet_hierarchy: OnetNode[];
};

type RoleMetrics = Record<MetricKey, number>;

interface RoleRecord {
  role: string;
  normalizedRole: string;
  onetCode: string | undefined;
  parentCluster: string;
  workforceShare: number;
  metrics: RoleMetrics | null;
  taskCount: number;
  coverage: number;
  tasks: RoleTaskRecord[];
}

interface RoleTaskRecord {
  name: string;
  normalizedWeight: number;
  count: number;
  metrics: RoleMetrics | null;
}

const onetHierarchy = onetData as OnetHierarchy;

type RoleCodeMap = Record<string, { title: string; code: string }>;

const roleCodes = onetRoleCodes as RoleCodeMap;

const roleCodeIndex: Map<string, string> = new Map(
  Object.entries(roleCodes).map(([key, value]) => [key.trim().toLowerCase(), value.code])
);

const roleIndex: Map<string, RoleRecord> = buildRoleIndex(onetHierarchy);

function buildRoleIndex(data: OnetHierarchy): Map<string, RoleRecord> {
  const index = new Map<string, RoleRecord>();

  for (const sector of data.onet_hierarchy ?? []) {
    for (const roleNode of sector.children ?? []) {
      const normalizedRole = normalizeRole(roleNode.cluster_name);

      if (index.has(normalizedRole)) {
        continue;
      }

      const workforceShare = getMetricValue(roleNode, "pct");
      const { metrics, coverage, taskCount, tasks } = aggregateRoleMetrics(roleNode, workforceShare);

      const onetCode = roleCodeIndex.get(normalizedRole);

      index.set(normalizedRole, {
        role: roleNode.cluster_name,
        normalizedRole,
        onetCode,
        parentCluster: sector.cluster_name,
        workforceShare,
        metrics,
        taskCount,
        coverage,
        tasks,
      });
    }
  }

  return index;
}

function aggregateRoleMetrics(roleNode: OnetNode, workforceShare: number) {
  const totals: Record<MetricKey, number> = Object.fromEntries(METRIC_KEYS.map((key) => [key, 0])) as RoleMetrics;

  const taskNodes = roleNode.children ?? [];
  const tasks: RoleTaskRecord[] = [];
  if (taskNodes.length === 0) {
    return { metrics: null, coverage: 0, taskCount: 0, tasks } as const;
  }

  let coverageAcc = 0;

  for (const task of taskNodes) {
    const taskWeight = getMetricValue(task, "pct");
    if (taskWeight) {
      coverageAcc += taskWeight;
    }

    const normalizedWeight = workforceShare > 0 && taskWeight > 0 ? taskWeight / workforceShare : 0;
    const metricsForTask = Object.fromEntries(
      METRIC_KEYS.map((metric) => [metric, getMetricValue(task, metric)]),
    ) as RoleMetrics;
    const hasData = METRIC_KEYS.some((metric) => metricsForTask[metric] > 0);

    tasks.push({
      name: task.cluster_name,
      normalizedWeight,
      count: getMetricValue(task, "count"),
      metrics: hasData ? metricsForTask : null,
    });

    if (workforceShare > 0 && taskWeight > 0) {
      for (const metric of METRIC_KEYS) {
        const value = metricsForTask[metric];
        if (value === undefined || Number.isNaN(value)) continue;
        totals[metric] += value * normalizedWeight;
      }
    }
  }

  const coverage = workforceShare > 0 ? coverageAcc / workforceShare : 0;

  if (coverage === 0) {
    return { metrics: null, coverage: 0, taskCount: taskNodes.length, tasks } as const;
  }

  const roundedMetrics = Object.fromEntries(
    METRIC_KEYS.map((metric) => [metric, round(totals[metric])]),
  ) as RoleMetrics;

  return { metrics: roundedMetrics, coverage, taskCount: taskNodes.length, tasks } as const;
}

function getMetricValue(node: OnetNode, metricKey: string): number {
  const metric = node.variable?.[metricKey];
  if (!metric?.global) {
    return 0;
  }

  const value = metric.global["GLOBAL"];

  return typeof value === "number" ? value : 0;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function round(value: number, precision: number = 2): number {
  return Number.parseFloat(value.toFixed(precision));
}

function roundCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function getClosestMatch(normalizedRole: string): string | undefined {
  let bestMatch: { role: string; distance: number } | undefined;
  for (const record of roleIndex.values()) {
    const distance = levenshtein(normalizedRole, record.normalizedRole);
    if (distance === 0) continue;
    const maxLen = Math.max(normalizedRole.length, record.normalizedRole.length);
    const threshold = Math.max(1, Math.ceil(maxLen * 0.2));
    if (distance > threshold) continue;

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { role: record.role, distance };
    }
  }

  return bestMatch?.role;
}

function sumRoleMetrics(metrics: RoleMetrics | null, keys: readonly MetricKey[]): number {
  if (!metrics) return 0;
  return keys.reduce((total, key) => {
    const value = metrics[key];
    return total + (Number.isFinite(value) ? (value as number) : 0);
  }, 0);
}

function classifyTaskMetrics(metrics: RoleMetrics | null): "automation" | "augmentation" | "none" {
  if (!metrics) return "none";
  const automation = sumRoleMetrics(metrics, AUTOMATION_KEYS);
  const augmentation = sumRoleMetrics(metrics, AUGMENTATION_KEYS);
  if (automation <= 0 && augmentation <= 0) return "none";
  return automation >= augmentation ? "automation" : "augmentation";
}

function getSuggestions(normalizedRole: string): string[] {
  const suggestions: string[] = [];
  for (const record of roleIndex.values()) {
    if (record.normalizedRole.includes(normalizedRole) || normalizedRole.includes(record.normalizedRole)) {
      suggestions.push(record.role);
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

export const getOnetRoleTools = () => {
  return {
    onet_role_metrics: tool({
      description:
        "Return task-level (e.g. for each of 20 tasks in a role) automation and augmentation statistics for a list of O*NET L1 roles. Provide role names that match O*NET job families.\n Note: Costs many thousand of tokens - Only use if you've already called onet_role_summary tool and seeing more detail is a necessity.",
      inputSchema: z.object({
        roles: z
          .array(z.string().trim().min(1, "Role name cannot be empty"))
          .min(1, "Provide at least one role")
          .describe("List of O*NET L1 role names to analyze"),
      }),
      execute: async ({ roles }) => {
        const seen = new Set<string>();
        const normalizedRoles = roles
          .map((role) => ({ requested: role, normalized: normalizeRole(role) }))
          .filter(({ normalized }) => {
            if (!normalized) return false;
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
          });

        const results: Array<{
          requested: string;
          role: string;
          onet_code: string | null;
          parent_cluster: string;
          workforce_share_pct: number;
          metrics: Record<string, number> | null;
          coverage_pct: number;
          task_count: number;
          tasks: Array<{
            name: string;
            task_share_pct: number;
            count: number;
            metrics: Record<string, number> | null;
          }>;
        }> = [];

        const invalidRoles: Array<{ requested: string; suggestions: string[]; did_you_mean?: string }> = [];

        for (const { normalized, requested } of normalizedRoles) {
          const record = roleIndex.get(normalized);
          if (!record) {
            const closestMatch = getClosestMatch(normalized);
            invalidRoles.push({
              requested,
              ...(closestMatch ? { did_you_mean: closestMatch } : {}),
              suggestions: getSuggestions(normalized),
            });
            continue;
          }

          const metrics = record.metrics
            ? Object.fromEntries(
                Object.entries(record.metrics).map(([metricKey, value]) => [METRIC_LABELS[metricKey as MetricKey], value]),
              )
            : null;

          results.push({
            requested,
            role: record.role,
            onet_code: record.onetCode ?? null,
            parent_cluster: record.parentCluster,
            workforce_share_pct: round(record.workforceShare, 4),
            metrics,
            coverage_pct: round(record.coverage * 100, 2),
            task_count: record.taskCount,
            tasks: record.tasks.map((task) => ({
              name: task.name,
              task_share_pct: round(task.normalizedWeight * 100, 2),
              count: roundCount(task.count),
              metrics: task.metrics
                ? Object.fromEntries(
                    Object.entries(task.metrics).map(([metricKey, value]) => [
                      METRIC_LABELS[metricKey as MetricKey],
                      round(value),
                    ]),
                  )
                : null,
            })),
          });
        }

        return {
          roles: results,
          invalid_roles: invalidRoles,
        };
      },
    }),
    onet_role_summary: tool({
      description:
        "Return role level statistics for O*NET L1 roles with counts of tasks leaning automation vs augmentation.",
      inputSchema: z.object({
        roles: z
          .array(z.string().trim().min(1, "Role name cannot be empty"))
          .min(1, "Provide at least one role")
          .describe("List of O*NET L1 role names to analyze at a high level. Only include role name e.g. First-Line Supervisors of Food Preparation and Serving Workers. Do not include the O*NET code."),
      }),
      execute: async ({ roles }) => {
        const seen = new Set<string>();
        const normalizedRoles = roles
          .map((role) => ({ requested: role, normalized: normalizeRole(role) }))
          .filter(({ normalized }) => {
            if (!normalized) return false;
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
          });

        const results: Array<{
          requested: string;
          role: string;
          onet_code: string | null;
          parent_cluster: string;
          automation_task_count: number;
          augmentation_task_count: number;
          manual_task_count: number;
          no_signal_task_count: number;
          task_count: number;
        }> = [];

        const invalidRoles: Array<{ requested: string; suggestions: string[]; did_you_mean?: string }> = [];

        for (const { normalized, requested } of normalizedRoles) {
          const record = roleIndex.get(normalized);
          if (!record) {
            const closestMatch = getClosestMatch(normalized);
            invalidRoles.push({
              requested,
              ...(closestMatch ? { did_you_mean: closestMatch } : {}),
              suggestions: getSuggestions(normalized),
            });
            continue;
          }

          let automationCount = 0;
          let augmentationCount = 0;
          let noneCount = 0;
          for (const task of record.tasks) {
            const group = classifyTaskMetrics(task.metrics);
            if (group === "automation") automationCount += 1;
            else if (group === "augmentation") augmentationCount += 1;
            else noneCount += 1;
          }

          results.push({
            requested,
            role: record.role,
            onet_code: record.onetCode ?? null,
            parent_cluster: record.parentCluster,
            automation_task_count: automationCount,
            augmentation_task_count: augmentationCount,
            manual_task_count: noneCount,
            no_signal_task_count: noneCount,
            task_count: record.taskCount,
          });
        }

        return {
          roles: results,
          invalid_roles: invalidRoles,
        };
      },
    }),
  };
};
