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
import { useTaskMixView } from "./task-mix-view-context";
import type { TaskMixView } from "@/lib/run/task-mix";
import {
  TASK_MIX_COLORS,
  TASK_MIX_LABELS,
  type TaskMixCategory,
  type TaskMixCounts,
  type TaskMixShares,
  getTaskMixTotal,
} from "@/lib/constants/task-mix";

const NODE_WIDTH = ORG_FLOW_NODE_WIDTH;
const SEGMENT_ORDER: TaskMixCategory[] = ["automation", "augmentation", "manual"];

function clampShare(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function getShareSummary(summary: OrgFlowDenseRoleSummary): TaskMixShares | null {
  if (summary.taskMixShares) {
    return summary.taskMixShares;
  }

  const auto = summary.automationShare ?? null;
  const aug = summary.augmentationShare ?? null;
  const manual =
    auto != null || aug != null
      ? Math.max(0, 1 - (auto ?? 0) - (aug ?? 0))
      : null;

  if (auto == null && aug == null && manual == null) {
    return null;
  }

  return {
    automation: auto,
    augmentation: aug,
    manual,
  };
}

function renderTaskMixBar(role: OrgFlowDenseRoleSummary, view: TaskMixView) {
  if (view === "coverage") {
    const counts: TaskMixCounts | null | undefined = role.taskMixCounts;
    const total = counts ? getTaskMixTotal(counts) : 0;

    if (!counts || total <= 0) {
      return (
        <div
          className="w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]"
          style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
        />
      );
    }

    return (
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
      >
        {SEGMENT_ORDER.map((category) => {
          const value = counts[category];
          if (value <= 0) {
            return null;
          }

          const widthPercent = (value / total) * 100;
          const label = TASK_MIX_LABELS[category];
          const aria = `${label}: ${value} tasks (${Math.round((value / total) * 100)}%)`;

          return (
            <div
              key={category}
              className="h-full"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: TASK_MIX_COLORS[category],
              }}
              aria-label={aria}
            />
          );
        })}
      </div>
    );
  }

  const shares = getShareSummary(role);
  const auto = clampShare(shares?.automation);
  const aug = clampShare(shares?.augmentation);
  const manualRaw = shares?.manual;
  const manual = manualRaw != null ? clampShare(manualRaw) : Math.max(0, 1 - auto - aug);
  const totalShare = auto + aug + manual;

  if (totalShare <= 0) {
    return (
      <div
        className="w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]"
        style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
      />
    );
  }

  const shareByCategory: Record<TaskMixCategory, number> = {
    automation: auto,
    augmentation: aug,
    manual,
  };

  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height: DENSE_ROLE_INDICATOR_HEIGHT }}
    >
      {SEGMENT_ORDER.map((category) => {
        const value = shareByCategory[category];
        if (value <= 0) {
          return null;
        }

        const widthPercent = (value / totalShare) * 100;
        const label = TASK_MIX_LABELS[category];
        const aria = `${label}: ${Math.round(value * 100)}%`;

        return (
          <div
            key={category}
            className="h-full"
            style={{
              width: `${widthPercent}%`,
              backgroundColor: TASK_MIX_COLORS[category],
            }}
            aria-label={aria}
          />
        );
      })}
    </div>
  );
}

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
                    {group.roles.map((role, index) => {
                      const roleHeadcount = role.headcount ?? null;
                      const share = roleHeadcount != null && nodeHeadcount ? roleHeadcount / nodeHeadcount : null;
                      const shareLabel = typeof share === "number" && share > 0 ? `${Math.round(share * 100)}%` : null;
                      const taskCounts = role.taskMixCounts ?? null;
                      const totalTasks = taskCounts ? getTaskMixTotal(taskCounts) : 0;
                      const shareSummary = getShareSummary(role);
                      const autoShare = shareSummary?.automation ?? role.automationShare ?? null;
                      const augShare = shareSummary?.augmentation ?? role.augmentationShare ?? null;
                      const manualShare = shareSummary?.manual ?? null;

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
                                {renderTaskMixBar(role, view)}
                              </div>
                              {/* {view === "coverage" && totalTasks > 0 && (
                                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[rgba(38,37,30,0.6)]">
                                  {`${taskCounts?.automation ?? 0}·${taskCounts?.augmentation ?? 0}·${taskCounts?.manual ?? 0} tasks`}
                                </div>
                              )} */}
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
                                {view === "coverage" ? (
                                  <div className="flex items-center font-bold gap-2">
                                    {taskCounts?.automation ? (
                                      <span className="text-[#B7410E]">{taskCounts.automation} auto</span>
                                    ) : null}
                                    {taskCounts?.augmentation ? (
                                      <span className="text-[#4F7F7D]">{taskCounts.augmentation} aug</span>
                                    ) : null}
                                    {taskCounts?.manual ? (
                                      <span className="text-[#26251e]">{taskCounts.manual} manual</span>
                                    ) : null}
                                    {(!taskCounts || totalTasks === 0) && (
                                      <span className="text-[#26251e]">No task coverage data</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center font-bold gap-2">
                                    {autoShare != null && (
                                      <span className="text-[#B7410E]">{Math.round(clampShare(autoShare) * 100)}% Auto</span>
                                    )}
                                    {augShare != null && (
                                      <span className="text-[#4F7F7D]">{Math.round(clampShare(augShare) * 100)}% Aug</span>
                                    )}
                                    {manualShare != null && (
                                      <span className="text-[#26251e]">{Math.round(clampShare(manualShare) * 100)}% Manual</span>
                                    )}
                                  </div>
                                )}
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
