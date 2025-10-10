"use client";

import clsx from "clsx";
import { Handle, NodeProps, Position } from "reactflow";

import type { OrgFlowNodeData, OrgFlowDenseRoleSummary } from "@/lib/run/org-flow-model";
import { ORG_FLOW_NODE_WIDTH } from "@/lib/run/org-flow-tokens";
import { DENSE_NODE_MUTED_TEXT_COLOR, DENSE_ROLE_ROW_GAP } from "./org-flow-tokens";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTaskMixView } from "./task-mix-view-context";
import { RoleTaskMixItem } from "./RoleTaskMixItem";

const NODE_WIDTH = ORG_FLOW_NODE_WIDTH;

function formatPercent(value: number | null | undefined): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return `${Math.round(value * 100)}%`;
}

export function DenseOrgNode({ id, data }: NodeProps<OrgFlowNodeData>) {
  if (!data) return null;

  const { view } = useTaskMixView();
  const {
    label,
    denseRoles,
    totalHeadcount,
    headcount,
    automationShare,
    augmentationShare,
    isHighlighted,
  } = data;

  const nodeHeadcount = totalHeadcount ?? headcount;
  const autoPercent = formatPercent(automationShare);
  const augPercent = formatPercent(augmentationShare);

  const roles = denseRoles ?? [];

  const groupedRoles = roles.reduce<Array<{
    id: string;
    label: string;
    headcount: number | null;
    roles: OrgFlowDenseRoleSummary[];
  }>>((acc, role, index) => {
    const groupId = role.groupId ?? `dense-group-${index}`;
    const groupLabel = role.groupLabel ?? "Roles";
    const groupHeadcount = role.groupHeadcount ?? null;
    let group = acc.find((entry) => entry.id === groupId);
    if (!group) {
      group = {
        id: groupId,
        label: groupLabel,
        headcount: groupHeadcount,
        roles: [],
      };
      acc.push(group);
    }

    group.roles.push(role);
    if (group.headcount == null && groupHeadcount != null) {
      group.headcount = groupHeadcount;
    }

    return acc;
  }, []);

  return (
    <TooltipProvider>
      <div
        className={clsx(
          "relative rounded-xl border border-[rgba(38,37,30,0.14)] bg-[#f7f5ef]/95 px-5 py-4 shadow-[0_18px_38px_rgba(34,28,20,0.08)]",
          isHighlighted && "ring-2 ring-[#FFAA72]",
        )}
        style={{ width: NODE_WIDTH }}
      >
        <Handle
          type="target"
          id={`${id}-target`}
          position={Position.Top}
          style={{ width: 8, height: 8, background: "#26251e" }}
        />
        <div className="flex flex-col gap-1">
          <div className="text-base font-medium text-[#26251e] leading-tight truncate text-center" title={label}>
            {label}
          </div>
          <div className="flex items-center justify-center gap-1">
            <div
              className="font-semibold text-[#26251e] leading-none text-[12px]"
            >
              {nodeHeadcount != null ? nodeHeadcount.toLocaleString() : "—"}
            </div>
            <div className="text-[12px]" style={{ color: DENSE_NODE_MUTED_TEXT_COLOR }}>
              employees
            </div>
            <div
              className="flex flex-wrap ml-2 gap-x-2 gap-y-1 text-[10px]"
              style={{ color: DENSE_NODE_MUTED_TEXT_COLOR }}
            >
              {autoPercent && (
                <span className="font-medium text-[#B7410E]">Auto {autoPercent}</span>
              )}
              {augPercent && (
                <span className="font-medium text-[#4F7F7D]">Aug {augPercent}</span>
              )}
            </div>
          </div>
        </div>
        {groupedRoles.length > 0 && (
          <div className="mt-4 flex flex-col space-y-6">
            {groupedRoles.map((group) => {
              const groupShare =
                group.headcount != null && nodeHeadcount
                  ? Math.round((group.headcount / nodeHeadcount) * 100)
                  : null;

              return (
                <div key={group.id} className="border-[rgba(68,37,30,0.52)] pl-4 -ml-5">
                  <div className="flex flex-col items-baseline justify-between gap-0.5 bg-orange-500/3  px-4 py-1 -ml-4 -mr-5 border-t border-b border-orange-500/10">
                    <div className="text-[12px] font-semibold text-[rgba(38,37,30,0.8)]">
                      {group.label}
                    </div>
                    <div className="text-[11px] text-[rgba(38,37,30,0.8)] font-medium">
                      {group.headcount != null ? `~${group.headcount.toLocaleString()} employees` : "—"}
                      <span className="opacity-75 text-[10px]">{groupShare != null && ` (${groupShare}%)`}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col" style={{ gap: DENSE_ROLE_ROW_GAP }}>
                    {group.roles.map((role, index) => (
                      <RoleTaskMixItem key={`${role.title}-${index}`} role={role} view={view} nodeHeadcount={nodeHeadcount} />
                    ))}
                  </div>
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
    </TooltipProvider>
  );
}
