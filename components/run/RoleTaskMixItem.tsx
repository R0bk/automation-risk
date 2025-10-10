"use client";

import clsx from "clsx";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TASK_MIX_COLORS,
  TASK_MIX_LABELS,
  type TaskMixCategory,
  type TaskMixCounts,
  getTaskMixTotal,
} from "@/lib/constants/task-mix";
import type { TaskMixView } from "@/lib/run/task-mix";
import type { OrgFlowDenseRoleSummary } from "@/lib/run/org-flow-model";

const SEGMENT_ORDER: TaskMixCategory[] = ["automation", "augmentation", "manual"];

function clampShare(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function getShareSummary(summary: OrgFlowDenseRoleSummary): {
  automation: number | null;
  augmentation: number | null;
  manual: number | null;
} | null {
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
          style={{ height: 4 }}
        />
      );
    }

    return (
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height: 4 }}
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
  const auto = clampShare(shares?.automation ?? role.automationShare ?? null);
  const aug = clampShare(shares?.augmentation ?? role.augmentationShare ?? null);
  const manualRaw = shares?.manual ?? null;
  const manual = manualRaw != null ? clampShare(manualRaw) : Math.max(0, 1 - auto - aug);
  const totalShare = auto + aug + manual;

  if (totalShare <= 0) {
    return (
      <div
        className="w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]"
        style={{ height: 4 }}
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
      style={{ height: 4 }}
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

export interface RoleTaskMixItemProps {
  role: OrgFlowDenseRoleSummary;
  view: TaskMixView;
  nodeHeadcount: number | null;
  className?: string;
}

export function RoleTaskMixItem({ role, view, nodeHeadcount, className }: RoleTaskMixItemProps) {
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
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={clsx(
            "rounded-lg bg-[rgba(38,37,30,0.075)] px-2 py-1 cursor-pointer",
            className,
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0 text-xs font-medium" style={{ color: "#26251e" }}>
              <div className="truncate" title={role.title}>
                {role.title}
              </div>
            </div>
            <div className="text-xs font-bold text-[#26251e]">
              {roleHeadcount != null ? roleHeadcount.toLocaleString() : "—"}
            </div>
          </div>
          <div className="mt-2">
            {renderTaskMixBar(role, view)}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-2 text-sm">
          <div className="font-semibold">{role.title}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "rgba(38,37,30,0.6)" }}>
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
                {autoShare == null && augShare == null && manualShare == null && (
                  <span className="text-[#26251e]">No task mix share data</span>
                )}
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
