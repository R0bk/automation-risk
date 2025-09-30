import { OrgFlowDirection, OrgFlowNode, OrgFlowEdge } from "./org-flow-model";
import { ORG_FLOW_NODE_DEFAULT_HEIGHT } from "./org-flow-tokens";

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

function getNodeHeight(node: OrgFlowNode): number {
  return node.layout.preferredHeight ?? ORG_FLOW_NODE_DEFAULT_HEIGHT;
}

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
    const sortedLevels = [...groupedByLevel.entries()].sort((a, b) => a[0] - b[0]);
    let yCursor = 0;

    for (const [, group] of sortedLevels) {
      const totalWidth = (group.length - 1) * horizontalGap;
      const baseX = -totalWidth / 2;

      group.forEach((node, index) => {
        positioned.push({
          ...node,
          position: {
            x: baseX + index * horizontalGap,
            y: yCursor,
          },
        });
      });

      const levelHeight = Math.max(
        ORG_FLOW_NODE_DEFAULT_HEIGHT,
        ...group.map((node) => getNodeHeight(node))
      );
      yCursor += levelHeight + verticalGap;
    }
  } else {
    const sortedLevels = [...groupedByLevel.entries()].sort((a, b) => a[0] - b[0]);
    sortedLevels.forEach(([, group]) => {
      group.sort((a, b) => a.layout.order - b.layout.order);
    });

    const levelXOffsets = new Map<number, number>();
    let xCursor = 0;

    for (const [level, group] of sortedLevels) {
      levelXOffsets.set(level, xCursor);
      xCursor += horizontalGap;
    }

    for (const [level, group] of sortedLevels) {
      const baseX = levelXOffsets.get(level) ?? level * horizontalGap;
      const totalHeight = (group.length - 1) * verticalGap;
      const baseY = -totalHeight / 2;

      group.forEach((node, index) => {
        positioned.push({
          ...node,
          position: {
            x: baseX,
            y: baseY + index * verticalGap,
          },
        });
      });
    }
  }

  return { nodes: positioned, edges };
}
