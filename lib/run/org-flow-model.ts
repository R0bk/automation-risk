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
}

const DEFAULT_OPTIONS: Required<Omit<BuildOrgFlowModelOptions, "includeCollapsedDescendants">> = {
  direction: "TB",
  engine: "dagre",
  maxRolesPerNode: 20,
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

    const rawChildren = node.children
      .map((childId) => graph.nodes.get(childId))
      .filter((maybeChild): maybeChild is OrgGraphNode => Boolean(maybeChild));

    const includedChildren = rawChildren.filter((child) =>
      shouldIncludeNode(child, includeCollapsedDescendants, graph.collapsedNodeIds)
    );

    const collapsibleRoleChildren =
      includedChildren.length > 0 && includedChildren.every((child) => isRoleLeafNode(child));

    const denseRoleSummaries = collapsibleRoleChildren
      ? includedChildren.flatMap((child) => toDenseRoleSummaries(child))
      : [];
    const denseRoleGroupCount = collapsibleRoleChildren ? includedChildren.length : 1;

    const nodeKind: OrgFlowNodeKind = collapsibleRoleChildren
      ? "denseRoleContainer"
      : isRoleLeafNode(node)
        ? "roleContainer"
        : "structure";

    const descendantCount = collapsibleRoleChildren
      ? Math.max(0, node.aggregate.descendantCount - includedChildren.length)
      : node.aggregate.descendantCount;

    const selfHighlighted = node.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds));
    const denseHighlight = collapsibleRoleChildren
      ? includedChildren.some((child) =>
          child.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds))
        )
      : false;

    const totalHeadcount = node.aggregate.headcount ?? node.data.headcount ?? null;
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
        isCollapsed: false, //graph.collapsedNodeIds.has(node.id), //HACK
        isHighlighted: selfHighlighted || denseHighlight,
      },
      layout: {
        order,
        preferredHeight,
      },
    });

    const collapsedChildIds = collapsibleRoleChildren
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
