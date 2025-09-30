import { OrgRole } from "./report-schema";
import { OrgGraph, OrgGraphNode } from "./org-graph";

export type OrgFlowLayoutEngine = "dagre" | "d3" | "elk";
export type OrgFlowDirection = "TB" | "LR";

export interface OrgFlowNodeData {
  id: string;
  label: string;
  level: number;
  parentId: string | null;
  headcount: number | null;
  automationShare: number | null;
  augmentationShare: number | null;
  descendantCount: number;
  roles: OrgRole[];
  isCollapsed: boolean;
  isHighlighted: boolean;
}

export interface OrgFlowNode {
  id: string;
  parentId: string | null;
  data: OrgFlowNodeData;
  layout: {
    order: number;
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
  maxRolesPerNode: 4,
};

function focusRoles(roles: OrgRole[], limit: number): OrgRole[] {
  if (roles.length <= limit) return roles;
  return roles.slice(0, limit);
}

function isRoleHighlighted(role: OrgRole, highlightIds: Set<string>): boolean {
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
  //HACK
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
        descendantCount: node.aggregate.descendantCount,
        roles: focusRoles(node.roles, mergedOptions.maxRolesPerNode),
        isCollapsed: false, //graph.collapsedNodeIds.has(node.id), //HACK
        isHighlighted: node.roles.some((role) => isRoleHighlighted(role, graph.highlightRoleIds)),
      },
      layout: {
        order,
      },
    });

    for (const childId of node.children) {
      const childNode = graph.nodes.get(childId);
      if (!childNode) continue;

      const parentExpanded = true; //!graph.collapsedNodeIds.has(node.id) || includeCollapsedDescendants; //HACK
      const childVisible = true; //!graph.collapsedNodeIds.has(childId) || includeCollapsedDescendants; //HACK

      if (!parentExpanded) {
        continue;
      }

      if (childVisible) {
        queue.push({ node: childNode, order: nodes.length + queue.length });
      }

      if (childVisible) {
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
