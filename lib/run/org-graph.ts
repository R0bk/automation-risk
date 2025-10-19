import {
  type EnrichedOrgReport,
  type EnrichedOrgNode,
  type EnrichedOrgRole,
} from "./report-schema";

type RoleLookupMap = Map<string, EnrichedOrgRole>;

type AggregationInternal = {
  headcount: number | null;
  automationWeightedSum: number;
  automationWeight: number;
  augmentationWeightedSum: number;
  augmentationWeight: number;
  descendantCount: number;
};

export interface OrgNodeAggregate {
  headcount: number | null;
  automationShare: number | null;
  augmentationShare: number | null;
  descendantCount: number;
}

export interface OrgGraphNode {
  id: string;
  data: EnrichedOrgNode;
  children: string[];
  parentId: string | null;
  roles: EnrichedOrgRole[];
  aggregate: OrgNodeAggregate;
}

export interface OrgGraph {
  nodes: Map<string, OrgGraphNode>;
  roots: string[];
  rolesById: RoleLookupMap;
  highlightRoleIds: Set<string>;
  collapsedNodeIds: Set<string>;
  rootId?: string;
}

const FALLBACK_ROLE_KEYS: Array<(role: EnrichedOrgRole) => string | undefined> = [
  (role) => role.onetCode,
  (role) => role.normalizedTitle,
  (role) => role.title,
];

function buildRoleLookup(rolesInput: EnrichedOrgRole[] | null | undefined): RoleLookupMap {
  const lookup: RoleLookupMap = new Map();
  const roles = Array.isArray(rolesInput) ? rolesInput : [];

  for (const role of roles) {
    for (const getter of FALLBACK_ROLE_KEYS) {
      const key = getter(role);
      if (!key) continue;
      const normalized = key.trim().toLowerCase();
      if (!normalized) continue;
      if (!lookup.has(normalized)) {
        lookup.set(normalized, role);
      }
    }
  }

  return lookup;
}

type DominantRoleEntry = { id: string; headcount: number | null };

function extractDominantRoleEntries(node: EnrichedOrgNode): DominantRoleEntry[] {
  const source = Array.isArray((node as unknown as { dominantRoles?: unknown }).dominantRoles)
    ? (node as unknown as { dominantRoles?: unknown }).dominantRoles
    : Array.isArray((node as unknown as { dominantRoleIds?: unknown }).dominantRoleIds)
      ? (node as unknown as { dominantRoleIds?: unknown }).dominantRoleIds
      : [];

  return (source as unknown[]).map((entry) => {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      return { id: trimmed.length > 0 ? trimmed : entry, headcount: null };
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const rawId = typeof record.id === "string" ? record.id : typeof record.code === "string" ? record.code : "";
      const trimmed = rawId.trim();
      const id = trimmed.length > 0 ? trimmed : rawId;
      const rawHeadcount = record.headcount;
      const headcount =
        typeof rawHeadcount === "number" && Number.isFinite(rawHeadcount)
          ? Math.max(0, Math.trunc(rawHeadcount))
          : null;
      return { id, headcount };
    }
    return { id: "", headcount: null };
  }).filter((entry) => Boolean(entry.id));
}

function resolveRolesForNode(
  node: EnrichedOrgNode,
  lookup: RoleLookupMap
): EnrichedOrgRole[] {
  const resolved: EnrichedOrgRole[] = [];
  const seen = new Set<string>();

  const dominantEntries = extractDominantRoleEntries(node);

  for (const entry of dominantEntries) {
    const rawId = entry.id;
    const normalized = rawId.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    const role = lookup.get(normalized);
    if (role) {
      const roleClone: EnrichedOrgRole = {
        ...role,
        headcount: entry.headcount ?? role.headcount ?? null,
      };
      resolved.push(roleClone);
      seen.add(normalized);
    }
  }

  const hasAnyHeadcount = resolved.some((role) => typeof role.headcount === "number" && role.headcount > 0);
  if (!hasAnyHeadcount && resolved.length > 0 && node.headcount != null && node.headcount > 0) {
    const equalShare = Math.max(1, Math.floor(node.headcount / resolved.length));
    let remaining = node.headcount;
    resolved.forEach((role, index) => {
      if (index === resolved.length - 1) {
        role.headcount = Math.max(0, remaining);
      } else {
        role.headcount = Math.max(0, equalShare);
        remaining -= equalShare;
      }
    });
  }

  // Order roles so the largest headcount entries appear first within each team.
  return resolved.sort((roleA, roleB) => {
    const headcountA = roleA.headcount ?? -1;
    const headcountB = roleB.headcount ?? -1;
    if (headcountA !== headcountB) {
      return headcountB - headcountA;
    }
    return roleA.title.localeCompare(roleB.title, undefined, { sensitivity: "base" });
  });
}

function createAggregationCalculator(
  nodes: Map<string, EnrichedOrgNode>,
  childrenMap: Map<string, string[]>
): {
  aggregates: Map<string, OrgNodeAggregate>;
} {
  const aggregates = new Map<string, OrgNodeAggregate>();
  const memo = new Map<string, AggregationInternal>();

  const visit = (id: string): AggregationInternal => {
    const memoized = memo.get(id);
    if (memoized) {
      return memoized;
    }

    const node = nodes.get(id);
    if (!node) {
      const empty: AggregationInternal = {
        headcount: null,
        automationWeightedSum: 0,
        automationWeight: 0,
        augmentationWeightedSum: 0,
        augmentationWeight: 0,
        descendantCount: 0,
      };
      memo.set(id, empty);
      return empty;
    }

    const children = childrenMap.get(id) ?? [];

    let totalHeadcount = node.headcount ?? null;
    const hasOwnHeadcount = node.headcount != null;
    let hasHeadcount = hasOwnHeadcount;

    let automationWeightedSum = 0;
    let automationWeight = 0;
    let augmentationWeightedSum = 0;
    let augmentationWeight = 0;

    const weightForNode = node.headcount ?? 1;

    if (node.automationShare != null) {
      automationWeightedSum += node.automationShare * weightForNode;
      automationWeight += weightForNode;
    }

    if (node.augmentationShare != null) {
      augmentationWeightedSum += node.augmentationShare * weightForNode;
      augmentationWeight += weightForNode;
    }

    let descendantCount = 0;

    for (const childId of children) {
      const childAggregation = visit(childId);

      if (!hasOwnHeadcount && childAggregation.headcount != null) {
        totalHeadcount = (totalHeadcount ?? 0) + childAggregation.headcount;
        hasHeadcount = true;
      }

      automationWeightedSum += childAggregation.automationWeightedSum;
      automationWeight += childAggregation.automationWeight;

      augmentationWeightedSum += childAggregation.augmentationWeightedSum;
      augmentationWeight += childAggregation.augmentationWeight;

      descendantCount += 1 + childAggregation.descendantCount;
    }

    const result: AggregationInternal = {
      headcount: hasHeadcount ? totalHeadcount : null,
      automationWeightedSum,
      automationWeight,
      augmentationWeightedSum,
      augmentationWeight,
      descendantCount,
    };

    memo.set(id, result);

    const aggregate: OrgNodeAggregate = {
      headcount: result.headcount,
      automationShare: result.automationWeight > 0 ? result.automationWeightedSum / result.automationWeight : null,
      augmentationShare: result.augmentationWeight > 0 ? result.augmentationWeightedSum / result.augmentationWeight : null,
      descendantCount: result.descendantCount,
    };

    aggregates.set(id, aggregate);

    return result;
  };

  for (const id of nodes.keys()) {
    visit(id);
  }

  return { aggregates };
}

function sortChildren(
  nodeIds: string[],
  nodes: Map<string, EnrichedOrgNode>
): string[] {
  return [...nodeIds].sort((a, b) => {
    const nodeA = nodes.get(a);
    const nodeB = nodes.get(b);
    if (!nodeA || !nodeB) return 0;

    const headcountA = nodeA.headcount ?? -1;
    const headcountB = nodeB.headcount ?? -1;
    if (headcountA !== headcountB) {
      return headcountB - headcountA;
    }

    return nodeA.name.localeCompare(nodeB.name, undefined, { sensitivity: "base" });
  });
}

export function buildOrgGraph(report: EnrichedOrgReport): OrgGraph {
  const nodeMap = new Map<string, EnrichedOrgNode>();
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  const rolesArray = Array.isArray(report.roles) ? report.roles : [];
  const lookup = buildRoleLookup(rolesArray);
  const rolesByNode = new Map<string, EnrichedOrgRole[]>();

  for (const node of report.hierarchy) {
    nodeMap.set(node.id, node);
    if (node.parentId) {
      const parentChildren = childrenMap.get(node.parentId) ?? [];
      parentChildren.push(node.id);
      childrenMap.set(node.parentId, parentChildren);
    } else {
      roots.push(node.id);
    }
  }

  for (const [parentId, childIds] of childrenMap.entries()) {
    childrenMap.set(parentId, sortChildren(childIds, nodeMap));
  }

  for (const node of report.hierarchy) {
    const roles = resolveRolesForNode(node, lookup);
    if (roles.length > 0) {
      rolesByNode.set(node.id, roles);
    }
  }

  const { aggregates } = createAggregationCalculator(nodeMap, childrenMap);

  const graphNodes = new Map<string, OrgGraphNode>();

  for (const node of report.hierarchy) {
    graphNodes.set(node.id, {
      id: node.id,
      data: node,
      children: childrenMap.get(node.id) ?? [],
      parentId: node.parentId ?? null,
      roles: rolesByNode.get(node.id) ?? [],
      aggregate: aggregates.get(node.id) ?? {
        headcount: node.headcount ?? null,
        automationShare: node.automationShare ?? null,
        augmentationShare: node.augmentationShare ?? null,
        descendantCount: 0,
      },
    });
  }

  const highlightRoleIds = new Set<string>(
    (report.visualizationHints?.highlightRoleIds ?? []).map((id) => id.trim().toLowerCase()).filter(Boolean)
  );

  const collapsedNodeIds = new Set<string>(report.visualizationHints?.collapsedNodeIds ?? []);

  const prioritizedRootId = report.visualizationHints?.rootId;

  return {
    nodes: graphNodes,
    roots: sortChildren(roots, nodeMap),
    rolesById: lookup,
    highlightRoleIds,
    collapsedNodeIds,
    rootId: prioritizedRootId && nodeMap.has(prioritizedRootId) ? prioritizedRootId : undefined,
  };
}

export function collectDescendants(graph: OrgGraph, nodeId: string): OrgGraphNode[] {
  const stack = [nodeId];
  const visited: OrgGraphNode[] = [];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;
    const node = graph.nodes.get(currentId);
    if (!node) continue;
    visited.push(node);
    for (const childId of node.children) {
      stack.push(childId);
    }
  }

  return visited;
}

export function getRootNodes(graph: OrgGraph): OrgGraphNode[] {
  return graph.roots
    .map((rootId) => graph.nodes.get(rootId))
    .filter((node): node is OrgGraphNode => Boolean(node));
}

export function getChildren(graph: OrgGraph, nodeId: string): OrgGraphNode[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];
  return node.children
    .map((childId) => graph.nodes.get(childId))
    .filter((child): child is OrgGraphNode => Boolean(child));
}
