import dagre from "@dagrejs/dagre";
import type { OrgFlowEdge, OrgFlowNode } from "./org-flow-model";

export const getLayoutedElements = (
  nodes: OrgFlowNode[],
  edges: OrgFlowEdge[],
  direction = "TB",
  nodeWidth = 300,
  nodeHeight = 360,
) => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  const levelMaxHeight = new Map<number, number>();

  nodes.forEach((node) => {
    const height = node.layout.preferredHeight ?? nodeHeight;
    dagreGraph.setNode(node.id, { width: nodeWidth, height });

    const level = node.data.level ?? 0;
    const current = levelMaxHeight.get(level) ?? 0;
    if (height > current) {
      levelMaxHeight.set(level, height);
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const height = node.layout.preferredHeight ?? nodeHeight;
    const level = node.data.level ?? 0;
    const referenceHeight = levelMaxHeight.get(level) ?? height;
    const topAlignedY = isHorizontal
      ? nodeWithPosition.y - height / 2
      : nodeWithPosition.y - referenceHeight / 2;

    const newNode = {
      ...node,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: topAlignedY,
      },
    };

    return newNode;
  });

  return { dagreGraph, nodes: newNodes, edges };
};
