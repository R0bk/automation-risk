import { OrgReport, OrgNode, OrgRole } from "./report-schema";

type RoleLookupMap = Map<string, OrgRole>;

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
  data: OrgNode;
  children: string[];
  parentId: string | null;
  roles: OrgRole[];
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

const FALLBACK_ROLE_KEYS: Array<(role: OrgRole) => string | undefined> = [
  (role) => role.onetCode,
  (role) => role.normalizedTitle,
  (role) => role.title,
];

function buildRoleLookup(roles: OrgRole[]): RoleLookupMap {
  const lookup: RoleLookupMap = new Map();

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

function resolveRolesForNode(node: OrgNode, lookup: RoleLookupMap): OrgRole[] {
  const resolved: OrgRole[] = [];
  const seen = new Set<string>();

  for (const rawId of node.dominantRoleIds ?? []) {
    const normalized = rawId.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    const role = lookup.get(normalized);
    if (role) {
      resolved.push(role);
      seen.add(normalized);
    }
  }

  return resolved;
}

function createAggregationCalculator(
  nodes: Map<string, OrgNode>,
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

    let totalHeadcount = node.headcount ?? 0;
    let hasHeadcount = node.headcount != null;

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

      if (childAggregation.headcount != null) {
        totalHeadcount += childAggregation.headcount;
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
  nodes: Map<string, OrgNode>
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

export function buildOrgGraph(report: OrgReport): OrgGraph {
  const nodeMap = new Map<string, OrgNode>();
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

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

  const lookup = buildRoleLookup(report.roles);
  const rolesByNode = new Map<string, OrgRole[]>();

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
