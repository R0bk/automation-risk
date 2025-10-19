import { EnrichedOrgRole } from "./report-schema";
import { OrgGraph, OrgGraphNode } from "./org-graph";
import {
  ORG_FLOW_NODE_DEFAULT_HEIGHT,
  getDenseNodePreferredHeight,
} from "./org-flow-tokens";
import type { TaskMixCounts, TaskMixShares } from "@/lib/constants/task-mix";
import { deriveTaskMixCounts, deriveTaskMixShares } from "./task-mix";

export type OrgFlowLayoutEngine = "dagre" | "d3" | "elk";
export type OrgFlowDirection = "TB" | "LR";

export type OrgFlowNodeKind = "structure" | "roleContainer" | "denseRoleContainer";

export interface OrgFlowDenseRoleSummary {
  title: string;
  onetCode?: string | null;
  headcount?: number | null;
  automationShare?: number | null;
  augmentationShare?: number | null;
  groupId?: string | null;
  groupLabel?: string | null;
  groupHeadcount?: number | null;
  taskMixCounts?: TaskMixCounts | null;
  taskMixShares?: TaskMixShares | null;
}

export interface OrgFlowNodeData {
  id: string;
  label: string;
  level: number;
  parentId: string | null;
  headcount: number | null;
  automationShare: number | null;
  augmentationShare: number | null;
  descendantCount: number;
  roles: EnrichedOrgRole[];
  denseRoles: OrgFlowDenseRoleSummary[];
  kind: OrgFlowNodeKind;
  totalHeadcount: number | null;
  isCollapsed: boolean;
  isHighlighted: boolean;
}

export interface OrgFlowNode {
  id: string;
  parentId: string | null;
  data: OrgFlowNodeData;
  layout: {
    order: number;
    preferredHeight?: number;
  };
}

export interface OrgFlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface BuildOrgFlowModelOptions {
  direction?: OrgFlowDirection;
  engine?: OrgFlowLayoutEngine;
  includeCollapsedDescendants?: boolean;
  maxRolesPerNode?: number;
  maxVisibleLevel?: number | null;
}

const DEFAULT_OPTIONS: Required<Omit<BuildOrgFlowModelOptions, "includeCollapsedDescendants">> = {
  direction: "TB",
  engine: "dagre",
  maxRolesPerNode: 20,
  maxVisibleLevel: null,
};

function isRoleLeafNode(node: OrgGraphNode): boolean {
  return node.children.length === 0 && node.roles.length > 0;
}

function toDenseRoleSummaries(node: OrgGraphNode): OrgFlowDenseRoleSummary[] {
  if (node.roles.length > 0) {
    const baseHeadcount = node.aggregate.headcount ?? node.data.headcount ?? null;
    const baseAutomation = node.data.automationShare ?? node.aggregate.automationShare ?? null;
    const baseAugmentation = node.data.augmentationShare ?? node.aggregate.augmentationShare ?? null;
    const groupLabel = node.data.name;
    const groupId = node.id;

    return node.roles.map((role) => ({
      title: role.title,
      onetCode: role.onetCode ?? null,
      headcount: role.headcount ?? baseHeadcount,
      automationShare: role.automationShare ?? baseAutomation,
      augmentationShare: role.augmentationShare ?? baseAugmentation,
      groupId,
      groupLabel,
      groupHeadcount: baseHeadcount,
      taskMixCounts: deriveTaskMixCounts(role),
      taskMixShares: deriveTaskMixShares(role),
    }));
  }

  const fallbackAutomation = node.data.automationShare ?? node.aggregate.automationShare ?? null;
  const fallbackAugmentation = node.data.augmentationShare ?? node.aggregate.augmentationShare ?? null;
  const inferredManual =
    fallbackAutomation != null || fallbackAugmentation != null
      ? Math.max(0, 1 - (fallbackAutomation ?? 0) - (fallbackAugmentation ?? 0))
      : null;

  return [
    {
      title: node.data.name,
      onetCode: null,
      headcount: node.aggregate.headcount ?? node.data.headcount ?? null,
      automationShare: fallbackAutomation,
      augmentationShare: fallbackAugmentation,
      groupId: node.id,
      groupLabel: node.data.name,
      groupHeadcount: node.aggregate.headcount ?? node.data.headcount ?? null,
      taskMixCounts: null,
      taskMixShares:
        fallbackAutomation != null || fallbackAugmentation != null || inferredManual != null
          ? {
              automation: fallbackAutomation,
              augmentation: fallbackAugmentation,
              manual: inferredManual,
            }
          : null,
    },
  ];
}

function collectRolesForNode(
  graph: OrgGraph,
  target: OrgGraphNode,
  grouping: OrgGraphNode
): { summaries: OrgFlowDenseRoleSummary[]; nodeCount: number; highlighted: boolean } {
  const summaries: OrgFlowDenseRoleSummary[] = [];
  let nodeCount = 1;
  let highlighted = target.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds));

  const groupHeadcount = grouping.aggregate.headcount ?? grouping.data.headcount ?? null;
  const defaultAutomation = grouping.data.automationShare ?? grouping.aggregate.automationShare ?? null;
  const defaultAugmentation = grouping.data.augmentationShare ?? grouping.aggregate.augmentationShare ?? null;

  if (target.roles.length > 0) {
    for (const role of target.roles) {
      summaries.push({
        title: role.title,
        onetCode: role.onetCode ?? null,
        headcount: role.headcount ?? null,
        automationShare: role.automationShare ?? defaultAutomation,
        augmentationShare: role.augmentationShare ?? defaultAugmentation,
        groupId: grouping.id,
        groupLabel: grouping.data.name,
        groupHeadcount,
        taskMixCounts: deriveTaskMixCounts(role),
        taskMixShares: deriveTaskMixShares(role),
      });
    }
  }

  if (target.children.length > 0) {
    for (const childId of target.children) {
      const childNode = graph.nodes.get(childId);
      if (!childNode) continue;
      const childResult = collectRolesForNode(graph, childNode, grouping);
      nodeCount += childResult.nodeCount;
      if (!highlighted && childResult.highlighted) {
        highlighted = true;
      }
      summaries.push(...childResult.summaries);
    }
  }

  if (summaries.length === 0) {
    const fallbackAutomation = defaultAutomation;
    const fallbackAugmentation = defaultAugmentation;
    const inferredManual =
      fallbackAutomation != null || fallbackAugmentation != null
        ? Math.max(0, 1 - (fallbackAutomation ?? 0) - (fallbackAugmentation ?? 0))
        : null;

    summaries.push({
      title: grouping.data.name,
      onetCode: null,
      headcount: groupHeadcount,
      automationShare: fallbackAutomation,
      augmentationShare: fallbackAugmentation,
      groupId: grouping.id,
      groupLabel: grouping.data.name,
      groupHeadcount,
      taskMixCounts: null,
      taskMixShares:
        fallbackAutomation != null || fallbackAugmentation != null || inferredManual != null
          ? {
              automation: fallbackAutomation,
              augmentation: fallbackAugmentation,
              manual: inferredManual,
            }
          : null,
    });
  }

  return { summaries, nodeCount, highlighted };
}

function collapseNodeDescendantSummaries(
  graph: OrgGraph,
  node: OrgGraphNode
): {
  summaries: OrgFlowDenseRoleSummary[];
  groupIds: Set<string>;
  descendantCount: number;
  highlighted: boolean;
} {
  const summaries: OrgFlowDenseRoleSummary[] = [];
  const groupIds = new Set<string>();
  let descendantCount = 0;
  let highlighted = false;

  for (const childId of node.children) {
    const childNode = graph.nodes.get(childId);
    if (!childNode) continue;
    const childResult = collectRolesForNode(graph, childNode, childNode);
    descendantCount += childResult.nodeCount;
    if (!highlighted && childResult.highlighted) {
      highlighted = true;
    }
    childResult.summaries.forEach((summary) => {
      summaries.push(summary);
      const key = summary.groupId ?? summary.groupLabel ?? summary.title ?? childNode.id;
      groupIds.add(key);
    });
  }

  return { summaries, groupIds, descendantCount, highlighted };
}

function focusRoles(roles: EnrichedOrgRole[], limit: number): EnrichedOrgRole[] {
  if (roles.length <= limit) return roles;
  return roles.slice(0, limit);
}

function isRoleHighlighted(role: EnrichedOrgRole, highlightIds: Set<string>): boolean {
  if (highlightIds.size === 0) return false;
  const candidates = [role.onetCode, role.normalizedTitle, role.title];
  return candidates.some((candidate) => {
    if (!candidate) return false;
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) return false;
    return highlightIds.has(normalized);
  });
}

function shouldIncludeNode(
  node: OrgGraphNode,
  includeCollapsedDescendants: boolean,
  collapsedNodeIds: Set<string>
): boolean {
  return true;
  if (!collapsedNodeIds.has(node.id)) {
    return true;
  }
  return includeCollapsedDescendants;
}

export function buildOrgFlowModel(
  graph: OrgGraph,
  options?: BuildOrgFlowModelOptions
): {
  nodes: OrgFlowNode[];
  edges: OrgFlowEdge[];
  direction: OrgFlowDirection;
  engine: OrgFlowLayoutEngine;
} {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const includeCollapsedDescendants = options?.includeCollapsedDescendants ?? false;
  const maxVisibleLevel = options?.maxVisibleLevel ?? null;

  const nodes: OrgFlowNode[] = [];
  const edges: OrgFlowEdge[] = [];

  const queue: Array<{ node: OrgGraphNode; order: number }> = [];

  const roots = graph.rootId ? [graph.rootId] : graph.roots;

  roots.forEach((rootId, index) => {
    const rootNode = graph.nodes.get(rootId);
    if (!rootNode) return;
    queue.push({ node: rootNode, order: index });
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { node, order } = current;

    if (!shouldIncludeNode(node, includeCollapsedDescendants, graph.collapsedNodeIds)) {
      continue;
    }

    const nodeLevel = node.data.level ?? 0;
    const canExpandChildren = maxVisibleLevel == null || nodeLevel < maxVisibleLevel;

    const rawChildren = node.children
      .map((childId) => graph.nodes.get(childId))
      .filter((maybeChild): maybeChild is OrgGraphNode => Boolean(maybeChild));

    const includedChildren = canExpandChildren
      ? rawChildren.filter((child) =>
          shouldIncludeNode(child, includeCollapsedDescendants, graph.collapsedNodeIds)
        )
      : [];

    const collapseByLevel = maxVisibleLevel != null && nodeLevel >= maxVisibleLevel;

    const childHeadcountSum = rawChildren.reduce((sum, child) => {
      const value = child.aggregate.headcount ?? child.data.headcount ?? null;
      if (value == null) return sum;
      return sum + value;
    }, 0);
    const hasChildHeadcount = childHeadcountSum > 0;
    const ownHeadcount = node.data.headcount ?? null;

    let totalHeadcount = node.aggregate.headcount ?? null;
    // Previously we attempted to ensure the node's total headcount included both its own value
    // and the sum of its children. In practice this doubled counts for datasets where parents
    // already report totals that include their descendants, so we temporarily rely solely on the
    // aggregated value. If we have no aggregate available, fall back to local data.
    if (totalHeadcount == null) {
      if (hasChildHeadcount) {
        totalHeadcount = childHeadcountSum;
      } else if (ownHeadcount != null) {
        totalHeadcount = ownHeadcount;
      }
    }
    // Legacy additive fallback kept for debugging. Re-enable if we want to combine parent and child headcounts.
    // if (hasChildHeadcount) {
    //   const combined = (ownHeadcount ?? 0) + childHeadcountSum;
    //   if (totalHeadcount == null || totalHeadcount < combined) {
    //     totalHeadcount = combined;
    //   }
    // }

    const collapsibleRoleChildren =
      !collapseByLevel &&
      includedChildren.length > 0 &&
      includedChildren.every((child) => isRoleLeafNode(child));

    const selfSummaries = node.roles.length > 0 ? toDenseRoleSummaries(node) : [];

    let descendantSummaries: OrgFlowDenseRoleSummary[] = [];
    let collapsedSubtreeCount = 0;
    let descendantHighlighted = false;

    const groupKeys = new Set<string>();
    selfSummaries.forEach((summary, index) => {
      const key = summary.groupId ?? summary.groupLabel ?? summary.title ?? `${node.id}-self-${index}`;
      groupKeys.add(key);
    });

    if (collapseByLevel) {
      const collapseResult = collapseNodeDescendantSummaries(graph, node);
      descendantSummaries = collapseResult.summaries;
      collapsedSubtreeCount = collapseResult.descendantCount;
      descendantHighlighted = collapseResult.highlighted;
      collapseResult.groupIds.forEach((key) => groupKeys.add(key));
    } else if (collapsibleRoleChildren) {
      descendantSummaries = includedChildren.flatMap((child) => toDenseRoleSummaries(child));
      collapsedSubtreeCount = includedChildren.length;
      descendantHighlighted = includedChildren.some((child) =>
        child.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds))
      );
      descendantSummaries.forEach((summary, index) => {
        const key = summary.groupId ?? summary.groupLabel ?? summary.title ?? `${node.id}-child-${index}`;
        groupKeys.add(key);
      });
    }

    const denseRoleSummaries = [...selfSummaries, ...descendantSummaries];
    const denseRoleGroupCount = Math.max(
      1,
      groupKeys.size > 0 ? groupKeys.size : denseRoleSummaries.length > 0 ? 1 : 0
    );

    const nodeKind: OrgFlowNodeKind = collapseByLevel || collapsibleRoleChildren
      ? "denseRoleContainer"
      : isRoleLeafNode(node)
        ? "roleContainer"
        : "structure";

    const collapsedChildCount = collapseByLevel
      ? collapsedSubtreeCount
      : collapsibleRoleChildren
        ? includedChildren.length
        : 0;

    const descendantCount = collapsedChildCount > 0
      ? Math.max(0, node.aggregate.descendantCount - collapsedChildCount)
      : node.aggregate.descendantCount;

    const selfHighlighted = node.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds));
    const denseHighlight = collapseByLevel
      ? descendantHighlighted
      : collapsibleRoleChildren
        ? descendantHighlighted
        : false;

    const preferredHeight =
      nodeKind === "denseRoleContainer"
        ? getDenseNodePreferredHeight(denseRoleSummaries.length, denseRoleGroupCount)
        : ORG_FLOW_NODE_DEFAULT_HEIGHT;

    nodes.push({
      id: node.id,
      parentId: node.parentId,
      data: {
        id: node.id,
        label: node.data.name,
        level: node.data.level,
        parentId: node.parentId,
        headcount: node.aggregate.headcount ?? node.data.headcount ?? null,
        automationShare: node.data.automationShare ?? node.aggregate.automationShare,
        augmentationShare: node.data.augmentationShare ?? node.aggregate.augmentationShare,
        descendantCount,
        roles: focusRoles(node.roles, mergedOptions.maxRolesPerNode),
        denseRoles: denseRoleSummaries,
        kind: nodeKind,
        totalHeadcount,
        isCollapsed: collapseByLevel,
        isHighlighted: selfHighlighted || denseHighlight,
      },
      layout: {
        order,
        preferredHeight,
      },
    });

    const collapsedChildIds = collapseByLevel
      ? new Set(rawChildren.map((child) => child.id))
      : collapsibleRoleChildren
        ? new Set(includedChildren.map((child) => child.id))
        : null;

    for (const childId of node.children) {
      const childNode = graph.nodes.get(childId);
      if (!childNode) continue;

      if (collapsedChildIds?.has(childId)) {
        continue;
      }

      const parentCollapsed = graph.collapsedNodeIds.has(node.id);
      const parentExpanded = !parentCollapsed || includeCollapsedDescendants;
      const childVisible = true; //shouldIncludeNode(childNode, includeCollapsedDescendants, graph.collapsedNodeIds);

      if (!parentExpanded) {
        continue;
      }

      if (childVisible) {
        queue.push({ node: childNode, order: nodes.length + queue.length });
        edges.push({
          id: `${node.id}-${childId}`,
          source: node.id,
          target: childId,
        });
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.debug("org-flow: skipped edge due to collapsed child", {
            parentId: node.id,
            childId,
          });
        }
      }
    }
  }

  return {
    nodes,
    edges,
    direction: mergedOptions.direction,
    engine: mergedOptions.engine,
  };
}
