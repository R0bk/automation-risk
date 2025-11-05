import "server-only";

import type {
  EnrichedOrgNode,
  EnrichedOrgReport,
  EnrichedOrgRole,
  OrgReport,
} from "@/lib/run/report-schema";
import { findJobRoleByCode, searchJobRolesByPrefix } from "@/lib/db/queries";
import type { JobRole } from "@/lib/db/schema";
import {
  buildCodeLookup,
  loadOnetCatalog,
  type OnetCatalogRole,
} from "@/lib/onet/catalog";

const PREFIX_CODE_REGEX = /^\d{2}-\d{4}$/;
type DominantRoleEntry = { id: string; headcount: number | null };

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
    return catalogLookup.get(jobRole.onetCode) || null;
  }

  const normalized = jobRole.normalizedTitle?.trim().toLowerCase();
  if (normalized && catalogNormalizedLookup?.has(normalized)) {
    return catalogNormalizedLookup.get(normalized) || null;
  }

  return null;
}

function ensureCatalogLookups() {
  if (!catalogLookup || !catalogNormalizedLookup) {
    const catalog = loadOnetCatalog();
    catalogLookup = buildCodeLookup(catalog);
    catalogNormalizedLookup = new Map(
      catalog.map((entry) => [entry.normalizedTitle, entry])
    );
  }
}

function getCatalogRoleByCode(code: string): OnetCatalogRole | null {
  ensureCatalogLookups();
  return catalogLookup?.get(code) || null;
}

function toShare(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  if (value <= 1) {
    return value;
  }

  if (value <= 100) {
    return Math.min(1, value / 100);
  }

  return 1;
}

function normalizeDominantRoles(node: { dominantRoles?: unknown; dominantRoleIds?: unknown }): DominantRoleEntry[] {
  const raw = Array.isArray(node.dominantRoles)
    ? node.dominantRoles
    : Array.isArray(node.dominantRoleIds)
      ? node.dominantRoleIds
      : [];

  const seen = new Set<string>();
  const result: DominantRoleEntry[] = [];

  for (const entry of raw as unknown[]) {
    let id: string | null = null;
    let headcount: number | null = null;

    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        id = trimmed;
      }
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const rawId = typeof record.id === "string" ? record.id : typeof record.code === "string" ? record.code : "";
      const trimmed = rawId.trim();
      if (trimmed) {
        id = trimmed;
      }

      const rawHeadcount = record.headcount;
      if (typeof rawHeadcount === "number" && Number.isFinite(rawHeadcount) && rawHeadcount >= 0) {
        headcount = Math.trunc(rawHeadcount);
      }
    }

    if (!id) continue;

    // Try to extract a valid O*NET code (e.g. 15-1132 or 15-1132.00)
    const match = id.match(/\d{2}-\d{4}(?:\.\d{2})?/);
    const cleaned = match ? match[0] : id.replace(/\s+/g, "");
    if (!cleaned || cleaned.length > 32) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: cleaned, headcount: headcount ?? null });
  }

  return result;
}

function normalizeHierarchyNodes(hierarchy: OrgReport["hierarchy"]): {
  nodes: EnrichedOrgNode[];
  roleCodes: string[];
} {
  const nodes: EnrichedOrgNode[] = [];
  const roleCodes = new Map<string, string>();

  for (const rawNode of hierarchy) {
    const dominantRoles = normalizeDominantRoles(rawNode);
    dominantRoles.forEach((entry) => {
      const key = entry.id.trim().toLowerCase();
      if (!roleCodes.has(key)) {
        roleCodes.set(key, entry.id);
      }
    });

    const { dominantRoleIds: _legacy, automationShare, augmentationShare, ...rest } = rawNode as any;

    nodes.push({
      ...rest,
      automationShare: toShare(automationShare),
      augmentationShare: toShare(augmentationShare),
      dominantRoles,
    });
  }

  return { nodes, roleCodes: Array.from(roleCodes.values()) };
}

async function loadJobRoleByCode(code: string): Promise<JobRole | null> {
  try {
    const match = await findJobRoleByCode(code);
    if (match) return match;
  } catch {}

  if (PREFIX_CODE_REGEX.test(code)) {
    try {
      const [match] = await searchJobRolesByPrefix(code, 1);
      if (match) {
        return match;
      }
    } catch {}
  }

  return null;
}

function shareFromCounts(count: number | null | undefined, total: number | null | undefined): number | null {
  if (!total || total <= 0 || count == null) {
    return null;
  }
  return toShare(count / total);
}

function buildRoleFromSources(code: string, jobRole: JobRole | null, catalogRole: OnetCatalogRole | null): EnrichedOrgRole {
  const title = jobRole?.title ?? catalogRole?.title ?? code;
  const normalizedTitle = jobRole?.normalizedTitle ?? catalogRole?.normalizedTitle ?? title.trim().toLowerCase();
  const parentCluster = jobRole?.parentCluster ?? catalogRole?.parentCluster;

  const catalogMetrics = catalogRole?.metrics;

  const catalogAutomationShare = catalogMetrics
    ? shareFromCounts(catalogMetrics.automationCount, catalogMetrics.totalCount) ?? toShare(catalogMetrics.metrics?.automation_pct ?? null)
    : null;
  const catalogAugmentationShare = catalogMetrics
    ? shareFromCounts(catalogMetrics.augmentationCount, catalogMetrics.totalCount) ?? toShare(catalogMetrics.metrics?.augmentation_pct ?? null)
    : null;

  const automationShare = catalogAutomationShare;
  const augmentationShare = catalogAugmentationShare;

  const catalogTaskCounts =
    catalogMetrics &&
    (catalogMetrics.automationTasks > 0 ||
      catalogMetrics.augmentationTasks > 0 ||
      catalogMetrics.manualTasks > 0 ||
      catalogMetrics.taskCount > 0)
      ? (() => {
          const automationTasks = Math.max(0, Math.trunc(catalogMetrics.automationTasks ?? 0));
          const augmentationTasks = Math.max(0, Math.trunc(catalogMetrics.augmentationTasks ?? 0));
          const manualTasks = Math.max(0, Math.trunc(catalogMetrics.manualTasks ?? 0));
          const declaredTotal = Math.max(0, Math.trunc(catalogMetrics.taskCount ?? 0));
          const derivedTotal = automationTasks + augmentationTasks + manualTasks;
          const total = Math.max(declaredTotal, derivedTotal);
          if (total === 0) {
            return undefined;
          }
          return {
            automation: automationTasks,
            augmentation: augmentationTasks,
            manual: manualTasks,
            total,
          };
        })()
      : undefined;

  const manualShare =
    automationShare == null && augmentationShare == null
      ? null
      : Math.max(0, Math.min(1, 1 - (automationShare ?? 0) - (augmentationShare ?? 0)));

  const taskMixShares =
    automationShare != null || augmentationShare != null || manualShare != null
      ? {
          automation: automationShare,
          augmentation: augmentationShare,
          manual: manualShare,
        }
      : undefined;

  return {
    onetCode: code,
    title,
    normalizedTitle: normalizedTitle || undefined,
    parentCluster: parentCluster || undefined,
    headcount: null,
    automationShare,
    augmentationShare,
    taskMixCounts: catalogTaskCounts,
    taskMixShares,
  };
}

async function buildRoleForCode(code: string): Promise<EnrichedOrgRole | null> {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const jobRole = await loadJobRoleByCode(trimmed);
  const catalogRole = jobRole ? getCatalogRoleFor(jobRole) : getCatalogRoleByCode(trimmed);

  if (!jobRole && !catalogRole) {
    return {
      onetCode: trimmed,
      title: trimmed,
      normalizedTitle: trimmed.toLowerCase(),
      parentCluster: undefined,
      headcount: null,
      automationShare: null,
      augmentationShare: null,
    };
  }

  return buildRoleFromSources(trimmed, jobRole, catalogRole);
}

export async function enrichReportWithJobRoles(report: OrgReport): Promise<EnrichedOrgReport> {
  const { nodes: normalizedHierarchy, roleCodes } = normalizeHierarchyNodes(report.hierarchy);

  const roles: EnrichedOrgRole[] = [];
  const seen = new Set<string>();
  for (const code of roleCodes) {
    const key = code.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const enriched = await buildRoleForCode(code);
    if (enriched) {
      roles.push(enriched);
    }
  }

  roles.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  const metadata = {
    ...report.metadata,
    lastUpdatedIso:
      (report.metadata as unknown as { lastUpdatedIso?: string }).lastUpdatedIso ?? new Date().toISOString(),
  };

  return {
    ...(report as object),
    metadata,
    hierarchy: normalizedHierarchy,
    roles,
  } as EnrichedOrgReport;
}
