"use client";

import { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import clsx from "clsx";

import "reactflow/dist/style.css";

import { useOrgReportGraph } from "@/hooks/useOrgReportGraph";
import { buildOrgFlowModel, type OrgFlowNodeData } from "@/lib/run/org-flow-model";
import { applyLayeredLayout } from "@/lib/run/org-flow-layout";
import type { OrgReport } from "@/lib/run/report-schema";
import { getLayoutedElements } from "@/lib/run/org-flow-layout-dagre";
import type { OrgRole } from "@/lib/run/report-schema";
import { TaskMixLine } from "./TaskMixLine";
import { deriveTaskMixForView } from "@/lib/run/task-mix";
import { useTaskMixView } from "./task-mix-view-context";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;
const LAYOUT_NODE_WIDTH = 230;
const LAYOUT_NODE_HEIGHT = 240;

interface OrgFlowChartProps {
  report: OrgReport;
}

const OrgNode = ({ id, data }: NodeProps<OrgFlowNodeData>) => {
  if (!data) return null;
  const { view } = useTaskMixView();
  const {
    label,
    headcount,
    automationShare,
    augmentationShare,
    roles,
    isCollapsed,
    isHighlighted,
  } = data as OrgFlowNodeData;

  return (
    <div
      className={clsx(
        "rounded-2xl border border-[rgba(38,37,30,0.14)] bg-[#f7f5ef]/95 px-4 py-3 shadow-[0_18px_38px_rgba(34,28,20,0.08)]",
        isHighlighted && "ring-2 ring-[#cf2d56]",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle
        type="target"
        id={`${id}-target`}
        position={Position.Top}
        style={{ width: 8, height: 8, background: "#26251e" }}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#26251e]">{label}</span>
        {isCollapsed && (
          <span className="rounded-full bg-[rgba(38,37,30,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[rgba(38,37,30,0.6)]">
            Collapsed
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[rgba(38,37,30,0.65)]">
        {headcount != null && (
          <span className="font-mono">HC {headcount.toLocaleString()}</span>
        )}
        {automationShare != null && (
          <span className="text-[#cf2d56]">Auto {(automationShare * 100).toFixed(0)}%</span>
        )}
        {augmentationShare != null && (
          <span className="text-[#2d6fce]">Aug {(augmentationShare * 100).toFixed(0)}%</span>
        )}
      </div>
      {roles && roles.length > 0 && (
        <div className="mt-3 space-y-1">
          {roles.map((role: OrgRole) => {
            const mix = deriveTaskMixForView(role, view);

            return (
              <div
                key={role.onetCode ?? role.title}
                className="rounded-lg bg-[rgba(38,37,30,0.06)] px-2 py-1 text-[11px] text-[rgba(38,37,30,0.75)]"
              >
                <div className="font-medium text-[#26251e]">{role.title}</div>
                {role.onetCode && (
                  <div className="text-[9px] uppercase tracking-[0.24em] text-[rgba(38,37,30,0.5)]">
                    {role.onetCode}
                  </div>
                )}
                <TaskMixLine counts={mix} height={2} className="mt-1" />
              </div>
            );
          })}
        </div>
      )}
      <Handle
        type="source"
        id={`${id}-source`}
        position={Position.Bottom}
        style={{ width: 8, height: 8, background: "#26251e" }}
      />
    </div>
  );
};

const defaultNodeTypes = { orgNode: OrgNode };

export function OrgFlowChart({ report }: OrgFlowChartProps) {
  const graph = useOrgReportGraph(report);
  const nodeTypes = useMemo(() => defaultNodeTypes, []);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph) {
      return { initialNodes: [], initialEdges: [] };
    }

    const model = buildOrgFlowModel(graph, {
      direction: "TB",
      engine: "dagre",
      maxRolesPerNode: 3,
    });

    if (process.env.NODE_ENV !== "production") {
      console.debug("org-flow:model", {
        nodeCount: model.nodes.length,
        edgeCount: model.edges.length,
        collapsed: Array.from(graph.collapsedNodeIds.values()),
      });
    }
    const layout = model.engine === "dagre" 
      ? getLayoutedElements(model.nodes, model.edges, model.direction, LAYOUT_NODE_WIDTH, LAYOUT_NODE_HEIGHT)
      : applyLayeredLayout(model.nodes, model.edges, {direction: model.direction});

    const nodes: Node<OrgFlowNodeData>[] = layout.nodes.map((node) => ({
      id: node.id,
      type: "orgNode",
      position: node.position,
      data: node.data,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { width: NODE_WIDTH },
    }));

    const edges: Edge[] = layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      type: "smoothstep",
    }));

    if (process.env.NODE_ENV !== "production") {
      const nodeIds = new Set(nodes.map((node) => node.id));
      const invalidEdges = edges.filter((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target));
      if (invalidEdges.length > 0) {
        console.warn("org-flow: invalid edges detected", invalidEdges);
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  if (!graph) {
    return (
      <div className="rounded-3xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.8)] p-6 text-sm text-[rgba(38,37,30,0.65)]">
        Organisation hierarchy not available yet.
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full rounded-3xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.4)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Background gap={24} size={1} color="rgba(38,37,30,0.08)" />
        <MiniMap nodeStrokeColor={() => "#26251e"} nodeColor={() => "#f7f5ef"} pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
