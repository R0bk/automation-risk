import { z } from "zod";
import { deriveTaskMixCounts } from "./task-mix";
import type {
  EnrichedAggregation,
  EnrichedOrgReport,
  EnrichedOrgRole,
} from "./report-schema";

type ImpactAccumulator = {
  totalHeadcount: number;
  automationImpact: number;
  augmentationImpact: number;
  knownHeadcount: number;
};

const debugWorkforceImpact = process.env.NODE_ENV !== "production";

export function buildRoleHeadcountMap(report: EnrichedOrgReport): Map<string, number> {
  const roleHeadcountFromNodes = new Map<string, number>();
  for (const node of report.hierarchy) {
    for (const entry of node.dominantRoles) {
      const key = entry.id.trim().toLowerCase();
      roleHeadcountFromNodes.set(key, (roleHeadcountFromNodes.get(key) ?? 0) + entry.headcount);
    }
  }

  return roleHeadcountFromNodes;
}

function collectRoleStats(report: EnrichedOrgReport): ImpactAccumulator | null {
  const roles = report.roles;
  if (roles.length === 0) return null;

  const roleHeadcountFromNodes = buildRoleHeadcountMap(report);

  if (roleHeadcountFromNodes.size === 0) return null;

  let totalHeadcount = 0;
  let automationImpact = 0;
  let augmentationImpact = 0;
  let knownHeadcount = 0;

  for (const [roleKey, headcount] of roleHeadcountFromNodes) {
    totalHeadcount += headcount;

    const role = roles.find(r => r.onetCode?.trim().toLowerCase() === roleKey);
    if (!role) {
      console.warn("[workforce-impact:role-not-found]", {
        roleKey,
        roles,
      });
      continue;
    }

    const counts = role.taskMixCounts ?? deriveTaskMixCounts(role);

    const totalTaskCount = counts.automation + counts.augmentation + counts.manual;

    if (!counts || totalTaskCount <= 0) {
      if (debugWorkforceImpact) {
      console.debug("[workforce-impact:role-skip]", { roleCode: roleKey, reason: "no-task-counts" });
      }
      continue;
    }

    const automationShare = counts.automation / totalTaskCount;
    const augmentationShare = counts.augmentation / totalTaskCount;

    automationImpact += headcount * automationShare;
    augmentationImpact += headcount * augmentationShare;

    knownHeadcount += headcount;

    if (debugWorkforceImpact) {
      console.debug("[workforce-impact:role]", {
        roleCode: roleKey,
        headcount,
        automationShare,
        augmentationShare,
        taskCounts: counts,
        shareSource: "counts",
      });
    }
  }

  if (knownHeadcount === 0) {
    return null;
  }

  if (totalHeadcount === 0) {
    totalHeadcount = knownHeadcount;
  }

  return {
    totalHeadcount,
    automationImpact,
    augmentationImpact,
    knownHeadcount,
  };
}

function clampShare(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export type WorkforceImpactSnapshot = ReturnType<typeof computeWorkforceImpact> & {
  percentiles?: {
    overall: number;
    automation: number;
    augmentation: number;
  };
  computedAt?: string;
};

export const workforceMetricSchema = z
  .object({
    score: z.coerce.number(),
    totalHeadcount: z.coerce.number(),
    automationImpact: z.coerce.number().optional(),
    augmentationImpact: z.coerce.number().optional(),
    coverageHeadcount: z.coerce.number().optional(),
    automationComponent: z.coerce.number().optional(),
    augmentationComponent: z.coerce.number().optional(),
    coverageComponent: z.coerce.number().optional(),
    components: z
      .object({
        automation: z.coerce.number().optional(),
        augmentation: z.coerce.number().optional(),
        coverage: z.coerce.number().optional(),
      })
      .partial()
      .optional(),
    percentiles: z
      .object({
        overall: z.coerce.number().optional(),
        automation: z.coerce.number().optional(),
        augmentation: z.coerce.number().optional(),
      })
      .optional(),
    computedAt: z.string().optional(),
  })
  .transform(
    (d) => {
      return {
        ...d,
        automationImpact: d.automationImpact ?? 0,
        augmentationImpact: d.augmentationImpact ?? 0,
        coverageHeadcount: d.coverageHeadcount ?? 0,
        automationComponent: d.automationComponent ?? d.components?.automation ?? 0,
        augmentationComponent: d.augmentationComponent ?? d.components?.augmentation ?? 0,
        coverageComponent: d.coverageComponent ?? d.components?.coverage ?? 0,
        components: { automation: d.automationComponent ?? d.components?.automation ?? 0, augmentation: d.augmentationComponent ?? d.components?.augmentation ?? 0, coverage: d.coverageComponent ?? d.components?.coverage ?? 0 },
        percentiles: d.percentiles
          ? {
              overall: d.percentiles.overall ?? 0,
              automation: d.percentiles.automation ?? 0,
              augmentation: d.percentiles.augmentation ?? 0,
            }
          : undefined,
      };
    }
  );

type MetricParseContext = {
  companyName?: string | null;
  runId?: string | null;
  source?: string;
};

export function parseWorkforceMetricData(
  data: unknown,
  context?: MetricParseContext
): WorkforceImpactSnapshot | null {
  const result = workforceMetricSchema.safeParse(data);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    console.debug("[workforce-impact:metric-parse-failed]", {
      companyName: context?.companyName ?? null,
      runId: context?.runId ?? null,
      source: context?.source ?? null,
      fieldErrors,
    });
    return null;
  }
  return result.data;
}

export type AggregationImpact = {
  type: EnrichedAggregation["type"];
  groupLabel: string;
  label: string;
  headcount: number;
  automationShare: number | null;
  augmentationShare: number | null;
  manualShare: number | null;
  impact: number | null;
  notes?: string;
};

export function collectAggregationImpacts(report: EnrichedOrgReport): AggregationImpact[] {
  const aggregations = report.aggregations ?? [];
  const impacts: AggregationImpact[] = [];

  for (const aggregation of aggregations) {
    for (const bucket of aggregation.buckets) {
      if (bucket.headcount == null || !Number.isFinite(bucket.headcount) || bucket.headcount <= 0) {
        continue;
      }

      const headcount = bucket.headcount;
      const automationShare = clampShare(bucket.automationShare);
      const augmentationShare = clampShare(bucket.augmentationShare);
      const manualShare =
        automationShare != null || augmentationShare != null
          ? Math.max(0, 1 - (automationShare ?? 0) - (augmentationShare ?? 0))
          : null;
      const impact =
        automationShare != null || augmentationShare != null
          ? headcount * ((automationShare ?? 0) +  (augmentationShare ?? 0))
          : null;

      impacts.push({
        type: aggregation.type,
        groupLabel: aggregation.label,
        label: bucket.key,
        headcount,
        automationShare,
        augmentationShare,
        manualShare,
        impact,
        notes: bucket.notes,
      });
    }
  }

  return impacts;
}

type RoleAccumulator = {
  role: EnrichedOrgRole | null;
  headcount: number;
  automationImpact: number;
  augmentationImpact: number;
  nodes: Array<{
    nodeId: string;
    nodeName: string;
    headcount: number;
    automationShare: number | null;
    augmentationShare: number | null;
  }>;
};

export type RoleImpact = {
  onetCode: string;
  title: string;
  headcount: number;
  automationShare: number | null;
  augmentationShare: number | null;
  manualShare: number | null;
  impact: number | null;
  nodes: RoleAccumulator["nodes"];
};

export function collectRoleImpacts(report: EnrichedOrgReport): RoleImpact[] {
  const roleByCode = new Map<string, EnrichedOrgRole>(
    report.roles.map((role) => [role.onetCode.trim().toLowerCase(), role])
  );

  const accumulator = new Map<string, RoleAccumulator>();

  for (const node of report.hierarchy) {
    if (node.dominantRoles.length === 0) continue;
    if (node.automationShare == null || node.augmentationShare == null) continue;

    for (const dominant of node.dominantRoles) {
      if (!dominant.id || dominant.headcount <= 0) continue;

      const key = dominant.id.trim().toLowerCase();
      const role = roleByCode.get(key) || null;
      if (role == null) console.warn("[workforce-impact:role-not-found]", {
        key,
        roleByCode,
      });
      const record = accumulator.get(key) ?? {
        role,
        headcount: 0,
        automationImpact: 0,
        augmentationImpact: 0,
        nodes: [],
      };

      record.headcount += dominant.headcount;

      record.automationImpact += dominant.headcount * node.automationShare;
      record.augmentationImpact += dominant.headcount * node.augmentationShare;

      record.nodes.push({
        nodeId: node.id,
        nodeName: node.name,
        headcount: dominant.headcount,
        automationShare: node.automationShare,
        augmentationShare: node.augmentationShare,
      });

      accumulator.set(key, record);
    }
  }

  const results: RoleImpact[] = [];

  for (const [key, record] of accumulator.entries()) {
    if (record.headcount <= 0) continue;

    const automationShare = record.automationImpact / record.headcount;
    const augmentationShare = record.augmentationImpact / record.headcount;

    const manualShare = 1 - (automationShare + augmentationShare);

    const impact = record.headcount * (automationShare +  augmentationShare);

    const resolvedRole = record.role;
    const onetCode = resolvedRole?.onetCode ?? record.role?.onetCode ?? key;
    const title = resolvedRole?.title ?? resolvedRole?.normalizedTitle ?? onetCode;

    results.push({
      onetCode,
      title,
      headcount: record.headcount,
      automationShare,
      augmentationShare,
      manualShare,
      impact,
      nodes: record.nodes,
    });
  }

  return results;
}

export function computeWorkforceImpact(report: EnrichedOrgReport) {
  const roleAccumulator = collectRoleStats(report);
  if (!roleAccumulator) {
    return null;
  }

  const { totalHeadcount, automationImpact, augmentationImpact, knownHeadcount } = roleAccumulator;
  const fallbackTotal =
    totalHeadcount > 0
      ? totalHeadcount
      : typeof report.metadata.workforceEstimate === "number"
        ? report.metadata.workforceEstimate
        : knownHeadcount;

  const safeTotal = fallbackTotal > 0 ? fallbackTotal : 1;
  const automationComponent = automationImpact / safeTotal;
  const augmentationComponent = augmentationImpact / safeTotal;
  const coverageComponent = knownHeadcount / safeTotal;

  const score = 10 * (automationComponent +  augmentationComponent);

  if (debugWorkforceImpact) {
    console.debug("[workforce-impact:aggregate]", {
      totalHeadcount,
      knownHeadcount,
      fallbackTotal,
      safeTotal,
      automationImpact,
      augmentationImpact,
      automationComponent,
      augmentationComponent,
      coverageComponent,
      score,
    });
  }

  const components = {
    automation: automationComponent,
    augmentation: augmentationComponent,
    coverage: coverageComponent,
  };

  return {
    score,
    totalHeadcount: safeTotal,
    automationImpact,
    augmentationImpact,
    coverageHeadcount: knownHeadcount,
    automationComponent,
    augmentationComponent,
    coverageComponent,
    components,
  };
}
