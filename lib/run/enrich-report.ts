import "server-only";

import type { OrgReport, OrgRole } from "@/lib/run/report-schema";
import {
  findJobRoleByCode,
  findJobRoleByNormalizedTitle,
  searchJobRolesByPrefix,
} from "@/lib/db/queries";
import type { JobRole } from "@/lib/db/schema";
import {
  buildCodeLookup,
  loadOnetCatalog,
  type OnetCatalogRole,
} from "@/lib/onet/catalog";

const FULL_CODE_REGEX = /^\d{2}-\d{4}\.\d{2}$/;
const PREFIX_CODE_REGEX = /^\d{2}-\d{4}$/;

interface JobRoleMetadata {
  automationCount?: number;
  augmentationCount?: number;
  manualCount?: number;
  totalCount?: number;
  coverage?: number | null;
  taskCount?: number;
  metrics?: Partial<Record<string, number>>;
  automationTasks?: number;
  augmentationTasks?: number;
  manualTasks?: number;
}

function registerRoleIdentifiers(registry: Map<string, OrgRole>, role: OrgRole) {
  const identifiers = [role.onetCode, role.normalizedTitle, role.title]
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean);

  for (const identifier of identifiers) {
    if (!registry.has(identifier)) {
      registry.set(identifier, role);
    }
  }
}

let catalogLookup: Map<string, OnetCatalogRole> | null = null;
let catalogNormalizedLookup: Map<string, OnetCatalogRole> | null = null;

function getCatalogRoleFor(jobRole: JobRole): OnetCatalogRole | null {
  if (!catalogLookup || !catalogNormalizedLookup) {
    const catalog = loadOnetCatalog();
    catalogLookup = buildCodeLookup(catalog);
    catalogNormalizedLookup = new Map(
      catalog.map((entry) => [entry.normalizedTitle, entry])
    );
  }

  if (catalogLookup?.has(jobRole.onetCode)) {
    return catalogLookup.get(jobRole.onetCode) ?? null;
  }

  const normalized = jobRole.normalizedTitle?.trim().toLowerCase();
  if (normalized && catalogNormalizedLookup?.has(normalized)) {
    return catalogNormalizedLookup.get(normalized) ?? null;
  }

  return null;
}

function jobRoleToOrgRole(role: JobRole): OrgRole {
  const metadata = (role.metadata ?? null) as JobRoleMetadata | null;
  const automationShare = metadata?.metrics?.automation_pct ?? null;
  const augmentationShare = metadata?.metrics?.augmentation_pct ?? null;
  const catalogRole = getCatalogRoleFor(role);

  let automationTasks = metadata?.automationTasks ?? metadata?.automationCount ?? null;
  let augmentationTasks = metadata?.augmentationTasks ?? metadata?.augmentationCount ?? null;
  let manualTasks = metadata?.manualTasks ?? metadata?.manualCount ?? null;
  let totalTasks = metadata?.taskCount ?? metadata?.totalCount ?? null;

  if (catalogRole) {
    const metrics = catalogRole.metrics;
    automationTasks = automationTasks ?? metrics.automationTasks ?? metrics.automationCount ?? 0;
    augmentationTasks = augmentationTasks ?? metrics.augmentationTasks ?? metrics.augmentationCount ?? 0;
    manualTasks = manualTasks ?? metrics.manualTasks ?? metrics.manualCount ?? 0;
    totalTasks = totalTasks ?? metrics.taskCount ?? metrics.totalCount ?? null;
  }

  if (
    typeof totalTasks === "number" &&
    typeof automationTasks === "number" &&
    typeof augmentationTasks === "number" &&
    typeof manualTasks !== "number"
  ) {
    manualTasks = Math.max(totalTasks - automationTasks - augmentationTasks, 0);
  }

  const resolvedAutomation = Math.max(0, Math.round(automationTasks ?? 0));
  const resolvedAugmentation = Math.max(0, Math.round(augmentationTasks ?? 0));
  const resolvedManual = Math.max(0, Math.round(manualTasks ?? 0));
  const resolvedTotal =
    typeof totalTasks === "number"
      ? Math.max(0, Math.round(totalTasks))
      : resolvedAutomation + resolvedAugmentation + resolvedManual;

  const taskMixCounts =
    resolvedAutomation + resolvedAugmentation + resolvedManual > 0
      ? {
          automation: resolvedAutomation,
          augmentation: resolvedAugmentation,
          manual: resolvedManual,
          total: resolvedTotal,
        }
      : undefined;

  const weightedTotal = catalogRole?.metrics.totalCount ?? metadata?.totalCount ?? null;
  const autoWeighted =
    weightedTotal && weightedTotal > 0
      ? (catalogRole?.metrics.automationCount ?? metadata?.automationCount ?? 0) / weightedTotal
      : metadata?.metrics?.automation_pct ?? null;
  const augWeighted =
    weightedTotal && weightedTotal > 0
      ? (catalogRole?.metrics.augmentationCount ?? metadata?.augmentationCount ?? 0) / weightedTotal
      : metadata?.metrics?.augmentation_pct ?? null;
  const manualWeightedCandidate =
    autoWeighted != null || augWeighted != null
      ? Math.max(0, 1 - (autoWeighted ?? 0) - (augWeighted ?? 0))
      : metadata?.metrics?.manual_pct ?? null;
  const manualWeighted =
    manualWeightedCandidate != null
      ? Math.max(0, Math.min(1, manualWeightedCandidate))
      : null;
  const taskMixShares =
    autoWeighted != null || augWeighted != null || manualWeighted != null
      ? {
          automation: autoWeighted,
          augmentation: augWeighted,
          manual: manualWeighted,
        }
      : undefined;

  return {
    onetCode: role.onetCode,
    title: role.title,
    normalizedTitle: role.normalizedTitle ?? undefined,
    parentCluster: role.parentCluster ?? undefined,
    automationShare: automationShare ?? null,
    augmentationShare: augmentationShare ?? null,
    taskMixCounts,
    taskMixShares,
  };
}

async function resolveJobRole(identifier: string, raw: string): Promise<JobRole | null> {
  if (FULL_CODE_REGEX.test(raw)) {
    return await findJobRoleByCode(raw);
  }

  if (PREFIX_CODE_REGEX.test(raw)) {
    const [match] = await searchJobRolesByPrefix(raw, 1);
    return match ?? null;
  }

  const normalizedLookup = await findJobRoleByNormalizedTitle(raw);
  if (normalizedLookup) {
    return normalizedLookup;
  }

  if (raw !== identifier) {
    const fallback = await findJobRoleByNormalizedTitle(identifier);
    if (fallback) {
      return fallback;
    }
  }

  if (PREFIX_CODE_REGEX.test(identifier)) {
    const [match] = await searchJobRolesByPrefix(identifier, 1);
    return match ?? null;
  }

  return null;
}

export async function enrichReportWithJobRoles(report: OrgReport): Promise<OrgReport> {
  const registry = new Map<string, OrgRole>();
  for (const role of report.roles) {
    registerRoleIdentifiers(registry, role);
  }

  const missing: Array<{ identifier: string; raw: string }> = [];
  const queued = new Set<string>();

  for (const node of report.hierarchy) {
    for (const rawId of node.dominantRoleIds ?? []) {
      const raw = rawId.trim();
      if (!raw) continue;
      const identifier = raw.toLowerCase();
      if (registry.has(identifier) || queued.has(identifier)) {
        continue;
      }
      queued.add(identifier);
      missing.push({ identifier, raw });
    }
  }

  if (!missing.length) {
    return report;
  }

  const enrichedRoles: OrgRole[] = [];

  for (const { identifier, raw } of missing) {
    const jobRole = await resolveJobRole(identifier, raw);
    if (!jobRole) {
      continue;
    }

    const orgRole = jobRoleToOrgRole(jobRole);
    registerRoleIdentifiers(registry, orgRole);
    enrichedRoles.push(orgRole);
  }

  if (!enrichedRoles.length) {
    return report;
  }

  return {
    ...report,
    roles: [...report.roles, ...enrichedRoles],
  };
}
