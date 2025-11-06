"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildOrgFlowModel, type OrgFlowNodeData, type OrgFlowDenseRoleSummary } from "@/lib/run/org-flow-model";
import { applyLayeredLayout } from "@/lib/run/org-flow-layout";
import type { EnrichedOrgReport, EnrichedOrgRole } from "@/lib/run/report-schema";
import { getLayoutedElements } from "@/lib/run/org-flow-layout-dagre";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { deriveTaskMixCounts, deriveTaskMixShares } from "@/lib/run/task-mix";
import { useTaskMixView } from "./task-mix-view-context";
import { DenseOrgNode } from "./DenseOrgNode";
import { ORG_FLOW_NODE_DEFAULT_HEIGHT, ORG_FLOW_NODE_WIDTH } from "@/lib/run/org-flow-tokens";
import { DENSE_NODE_HEADCOUNT_FONT_SIZE, DENSE_NODE_MUTED_TEXT_COLOR } from "./org-flow-tokens";
import { RoleTaskMixItem } from "./RoleTaskMixItem";

const NODE_WIDTH = ORG_FLOW_NODE_WIDTH;
const LAYOUT_NODE_WIDTH = ORG_FLOW_NODE_WIDTH - 30;
const LAYOUT_NODE_HEIGHT = ORG_FLOW_NODE_DEFAULT_HEIGHT;

interface OrgFlowChartProps {
  report: EnrichedOrgReport;
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
    totalHeadcount,
    kind,
  } = data as OrgFlowNodeData;

  const nodeHeadcount = totalHeadcount ?? headcount;
  const automationPercent =
    typeof automationShare === "number" ? `${Math.round(automationShare * 100)}%` : null;
  const augmentationPercent =
    typeof augmentationShare === "number" ? `${Math.round(augmentationShare * 100)}%` : null;

  return (
    <div
      className={clsx(
        "relative rounded-2xl border border-[rgba(38,37,30,0.14)] bg-[#f7f5ef]/95 px-4 py-4 shadow-[0_18px_38px_rgba(34,28,20,0.08)]",
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-sm font-semibold leading-tight text-[#26251e]" title={label}>
            {label}
          </span>
          {isCollapsed && (
            <span className="mt-1 inline-flex rounded-full bg-[rgba(38,37,30,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[rgba(38,37,30,0.6)]">
              Collapsed
            </span>
          )}
        </div>
        <div className="text-right">
          <div
            className="font-semibold leading-none text-[#26251e]"
            style={{ fontSize: DENSE_NODE_HEADCOUNT_FONT_SIZE }}
          >
            {nodeHeadcount != null ? nodeHeadcount.toLocaleString() : "—"}
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.16em]"
            style={{ color: DENSE_NODE_MUTED_TEXT_COLOR }}
          >
            Headcount
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: DENSE_NODE_MUTED_TEXT_COLOR }}>
        {automationPercent && <span className="font-medium text-[#cf2d56]">Auto {automationPercent}</span>}
        {augmentationPercent && <span className="font-medium text-[#2d6fce]">Aug {augmentationPercent}</span>}
      </div>
      {roles && roles.length > 0 && (
        <TooltipProvider>
          <div className="mt-3 space-y-2">
            {roles.map((role: EnrichedOrgRole) => {
              const summary: OrgFlowDenseRoleSummary = {
                title: role.title,
                onetCode: role.onetCode ?? null,
                headcount: role.headcount ?? null,
                automationShare: role.automationShare ?? null,
                augmentationShare: role.augmentationShare ?? null,
                groupId: role.onetCode ?? role.title,
                groupLabel: label,
                groupHeadcount: nodeHeadcount ?? null,
                taskMixCounts: deriveTaskMixCounts(role),
                taskMixShares: deriveTaskMixShares(role),
              };

              return (
                <RoleTaskMixItem
                  key={role.onetCode ?? role.title}
                  role={summary}
                  view={view}
                  nodeHeadcount={nodeHeadcount ?? null}
                  className="bg-[rgba(38,37,30,0.06)]"
                />
              );
            })}
          </div>
        </TooltipProvider>
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

const defaultNodeTypes = { orgNode: OrgNode, denseOrgNode: DenseOrgNode };

const LEVEL_OPTIONS = [1, 2, 3, 4] as const;

export function OrgFlowChart({ report }: OrgFlowChartProps) {
  const graph = useOrgReportGraph(report);
  const nodeTypes = useMemo(() => defaultNodeTypes, []);
  const [maxVisibleLevel, setMaxVisibleLevel] = useState<number>(1);

  const maxGraphLevel = useMemo(() => {
    if (!graph) return 1;
    let maxLevel = 1;
    graph.nodes.forEach((node) => {
      const level = node.data.level ?? 0;
      if (level > maxLevel) {
        maxLevel = level;
      }
    });
    return maxLevel;
  }, [graph]);

  useEffect(() => {
    if (!graph) {
      return;
    }

    const availableLevels = LEVEL_OPTIONS.filter((level) => level <= maxGraphLevel);
    const fallbackLevel =
      availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : LEVEL_OPTIONS[0];

    setMaxVisibleLevel((current) => {
      if (current > fallbackLevel) {
        return fallbackLevel;
      }
      return current;
    });
  }, [graph, maxGraphLevel]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph) {
      return { initialNodes: [], initialEdges: [] };
    }

    const model = buildOrgFlowModel(graph, {
      direction: "TB",
      engine: "dagre",
      maxRolesPerNode: 20,
      maxVisibleLevel,
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

    const nodes: Node<OrgFlowNodeData>[] = layout.nodes.map((node) => {
      const nodeType = node.data.kind === "denseRoleContainer" ? "denseOrgNode" : "orgNode";
      return {
        id: node.id,
        type: nodeType,
        position: node.position,
        data: node.data,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: { width: NODE_WIDTH },
      };
    });

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
  }, [graph, maxVisibleLevel]);

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
    <div className="relative h-[900px] w-full min-w-0">
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex flex-col gap-2">
        {LEVEL_OPTIONS.map((level) => {
          const disabled = level > maxGraphLevel;
          const isActive = maxVisibleLevel === level;
          return (
            <Button
              key={level}
              size="sm"
              variant="ghost"
              onClick={() => setMaxVisibleLevel(level)}
              disabled={disabled}
              aria-pressed={isActive}
              className={clsx(
                "min-w-[56px] rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] transition",
                "backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] shadow-[0_18px_40px_rgba(34,28,20,0.12)]",
                "text-[rgba(38,37,30,0.68)] border-[rgba(38,37,30,0.14)] bg-[rgba(244,242,236,0.48)]",
                "hover:border-[rgba(38,37,30,0.24)] hover:bg-[rgba(254,252,247,0.72)]",
                isActive &&
                  "border-[rgba(207,45,86,0.38)] bg-[rgba(255,252,247,0.9)] text-[#26251e] shadow-[0_22px_48px_rgba(34,28,20,0.18)]",
                disabled && "cursor-not-allowed opacity-40 hover:border-[rgba(38,37,30,0.14)] hover:bg-[rgba(244,242,236,0.48)]"
              )}
            >
              L{level}
            </Button>
          );
        })}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Background gap={24} size={1} color="rgba(38,37,30,0.08)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
