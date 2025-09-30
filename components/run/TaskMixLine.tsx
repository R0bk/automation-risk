"use client";

import React from "react";
import clsx from "clsx";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  TASK_MIX_COLORS,
  TASK_MIX_LABELS,
  getTaskMixTotal,
  type TaskMixCounts,
  type TaskMixCategory,
} from "@/lib/constants/task-mix";

interface TaskMixLineProps {
  counts: TaskMixCounts;
  className?: string;
  height?: number;
}

const SEGMENT_ORDER: TaskMixCategory[] = ["automation", "augmentation", "manual"];

export const TaskMixLine: React.FC<TaskMixLineProps> = ({ counts, className, height = 10 }) => {
  const total = getTaskMixTotal(counts);

  if (total === 0) {
    return (
      <div
        className={clsx(
          "w-full overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]",
          className,
        )}
        style={{ height }}
      />
    );
  }

  return (
    <div
      className={clsx("flex w-full overflow-hidden rounded-full", className)}
      style={{ height }}
    >
      {SEGMENT_ORDER.map((category) => {
        const value = counts[category];
        if (value <= 0) {
          return null;
        }

        const widthPercent = (value / total) * 100;
        const label = TASK_MIX_LABELS[category];
        const tooltip = `${label}: ${value}/${total} tasks`;

        return (
          <TooltipProvider delayDuration={150} key={category} >
          <Tooltip key={category}>
            <TooltipTrigger asChild>
              <div
                className="cursor-help"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: TASK_MIX_COLORS[category],
                }}
                aria-label={tooltip}
              />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

