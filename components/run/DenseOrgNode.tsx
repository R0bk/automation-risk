"use client";

import clsx from "clsx";
import { Handle, NodeProps, Position } from "reactflow";

import type { OrgFlowNodeData, OrgFlowDenseRoleSummary } from "@/lib/run/org-flow-model";
import { ORG_FLOW_NODE_WIDTH } from "@/lib/run/org-flow-tokens";
import {
  DENSE_NODE_HEADCOUNT_FONT_SIZE,
  DENSE_NODE_MUTED_TEXT_COLOR,
  DENSE_ROLE_INDICATOR_HEIGHT,
  DENSE_ROLE_META_COLOR,
  DENSE_ROLE_ROW_GAP,
  DENSE_ROLE_SEPARATOR_COLOR,
  DENSE_ROLE_TITLE_COLOR,
} from "./org-flow-tokens";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NODE_WIDTH = ORG_FLOW_NODE_WIDTH;

function formatPercent(value: number | null | undefined): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return `${Math.round(value * 100)}%`;
}

function renderTaskMixBar(role: OrgFlowDenseRoleSummary) {
  const auto = typeof role.automationShare === "number" ? Math.max(0, Math.min(1, role.automationShare)) : 0;
  const aug = typeof role.augmentationShare === "number" ? Math.max(0, Math.min(1 - auto, role.augmentationShare)) : 0;
  const manual = Math.max(0, 1 - auto - aug);
  const total = auto + aug + manual;

  if (total <= 0) {
    return (
      <div
        className="w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]"
        style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
      />
    );
  }

  const segments: Array<{ key: string; value: number; color: string; label: string }> = [
    // { key: "automation", value: auto, color: "#627A68", label: "Automation" },
    // { key: "augmentation", value: aug, color: "#58708A", label: "Augmentation" },
    { key: "automation", value: auto, color: "#B7410E", label: "Automation" },
    { key: "augmentation", value: aug, color: "#4F7F7D", label: "Augmentation" },
    { key: "manual", value: manual, color: "#D1D5DB", label: "Manual" },
  ].filter((segment) => segment.value > 0);

  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          className="h-full"
          style={{
            width: `${(segment.value / total) * 100}%`,
            backgroundColor: segment.color,
          }}
          aria-label={`${segment.label} ${(segment.value * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

export function DenseOrgNode({ id, data }: NodeProps<OrgFlowNodeData>) {
  if (!data) return null;

  const {
    label,
    level,
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
                  <div className="flex items-baseline justify-between gap-0.5 bg-orange-500/3  px-4 py-1 -ml-4 -mr-5 border-t border-b border-orange-500/10">
                    <div className="text-[12px] font-semibold text-[rgba(38,37,30,0.8)]">
                      {group.label}
                    </div>
                    <div className="text-[12px] text-[rgba(38,37,30,0.8)] text-right">
                      {group.headcount != null ? group.headcount.toLocaleString() : "—"}
                      <span className="opacity-75 text-[10px]">{groupShare != null && ` · ${groupShare}%`}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col" style={{ gap: DENSE_ROLE_ROW_GAP }}>
                    {group.roles.map((role, index) => {
              const roleHeadcount = role.headcount ?? null;
              const share = roleHeadcount != null && nodeHeadcount ? roleHeadcount / nodeHeadcount : null;
              const shareLabel = typeof share === "number" && share > 0 ? `${Math.round(share * 100)}%` : null;

              return (
              <Tooltip key={`${role.title}-${role.onetCode ?? index}`}>
                <TooltipTrigger asChild>
                  <div
                    className={"rounded-lg bg-[rgba(38,37,30,0.075)] px-2 py-1 cursor-pointer"}
                    style={{ borderColor: index > 0 ? DENSE_ROLE_SEPARATOR_COLOR : "transparent" }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 text-xs font-medium" style={{ color: DENSE_ROLE_TITLE_COLOR }}>
                        <div className="truncate" title={role.title}>
                          {role.title}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[#26251e]">
                        {roleHeadcount != null ? roleHeadcount.toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="mt-1">
                      {renderTaskMixBar(role)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="font-semibold">{role.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: DENSE_ROLE_META_COLOR }}>
                      <div className="flex items-center gap-2">
                        {role.onetCode && <span className="uppercase tracking-[0.12em]">{role.onetCode}</span>}
                        {shareLabel && <span>{shareLabel} of node</span>}
                      </div>
                      <div className="flex items-center font-bold gap-2">
                        {role.automationShare != null && (
                          <span className="text-[#B7410E]">{(role.automationShare * 100).toFixed(0)}% Auto</span>
                        )}
                        {role.augmentationShare != null && (
                          <span className="text-[#4F7F7D]">{(role.augmentationShare * 100).toFixed(0)}% Aug</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              );
                    })}
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
