import { OrgFlowDirection, OrgFlowNode, OrgFlowEdge } from "./org-flow-model";

export interface PositionedOrgFlowNode extends OrgFlowNode {
  position: { x: number; y: number };
}

export interface OrgFlowDiagram {
  nodes: PositionedOrgFlowNode[];
  edges: OrgFlowEdge[];
}

export interface OrgFlowLayoutOptions {
  direction: OrgFlowDirection;
  horizontalGap?: number;
  verticalGap?: number;
}

const DEFAULT_HORIZONTAL_GAP = 300;
const DEFAULT_VERTICAL_GAP = 360;

export function applyLayeredLayout(
  nodes: OrgFlowNode[],
  edges: OrgFlowEdge[],
  options: OrgFlowLayoutOptions
): OrgFlowDiagram {
  const horizontalGap = options.horizontalGap ?? DEFAULT_HORIZONTAL_GAP;
  const verticalGap = options.verticalGap ?? DEFAULT_VERTICAL_GAP;

  const groupedByLevel = new Map<number, OrgFlowNode[]>();

  for (const node of nodes) {
    const level = node.data.level ?? 0;
    const existing = groupedByLevel.get(level) ?? [];
    existing.push(node);
    groupedByLevel.set(level, existing);
  }

  for (const [, group] of groupedByLevel.entries()) {
    group.sort((a, b) => a.layout.order - b.layout.order);
  }

  const positioned: PositionedOrgFlowNode[] = [];

  if (options.direction === "TB") {
    for (const [level, group] of [...groupedByLevel.entries()].sort((a, b) => a[0] - b[0])) {
      const totalWidth = (group.length - 1) * horizontalGap;
      const baseX = -totalWidth / 2;
      group.forEach((node, index) => {
        positioned.push({
          ...node,
          position: {
            x: baseX + index * horizontalGap,
            y: level * verticalGap,
          },
        });
      });
    }
  } else {
    for (const [level, group] of [...groupedByLevel.entries()].sort((a, b) => a[0] - b[0])) {
      const totalHeight = (group.length - 1) * verticalGap;
      const baseY = -totalHeight / 2;
      group.forEach((node, index) => {
        positioned.push({
          ...node,
          position: {
            x: level * horizontalGap,
            y: baseY + index * verticalGap,
          },
        });
      });
    }
  }

  return { nodes: positioned, edges };
}

