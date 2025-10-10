import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import React from "react";

import { TextShimmer } from "../../text-shimmer";
import { ToolContainer } from "./tool-container";
import type { ChatMessage } from "@/lib/types";
import { TASK_MIX_COLORS, type TaskMixCategory } from "@/lib/constants/task-mix";
import { PulsingDot } from "@/components/run/pulsing-dot";

const METRIC_DISPLAY_ORDER = [
  "Automation",
  "Augmentation",
  "Directive",
  "Feedback",
  "Validation",
  "Task Iteration",
  "Learning",
] as const;

type MetricName = (typeof METRIC_DISPLAY_ORDER)[number];
type OnetRoleMetricsToolPart = Extract<ChatMessage["parts"][number], { type: "tool-onet_role_metrics" }>;

type OnetRoleMetricsPayload = {
  roles?: {
    requested: string;
    role: string;
    onet_code?: string | null;
    parent_cluster: string;
    workforce_share_pct: number;
    metrics: Partial<Record<MetricName, number>> | null;
    coverage_pct: number;
    task_count: number;
    tasks?: {
      name: string;
      task_share_pct: number;
      count: number;
      metrics: Partial<Record<MetricName, number>> | null;
    }[];
  }[];
  invalid_roles?: {
    requested: string;
    suggestions?: string[];
    did_you_mean?: string;
  }[];
};

type RoleItem = NonNullable<OnetRoleMetricsPayload["roles"]>[number];
type ToolTask = NonNullable<RoleItem["tasks"]>[number];

const AUTOMATION_METRICS: MetricName[] = ["Automation", "Directive", "Feedback"];
const AUGMENTATION_METRICS: MetricName[] = ["Augmentation", "Task Iteration", "Validation", "Learning"];

type TaskGroup = TaskMixCategory;

const TASK_GROUP_ORDER: TaskGroup[] = ["automation", "augmentation", "manual"];

const formatPercent = (value: number | undefined, fractionDigits: number = 2) => {
  if (value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: value > 0 && value < 1 ? fractionDigits : 0,
  })}%`;
};

const formatCount = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

const sumMetricGroup = (metrics: Partial<Record<MetricName, number>> | null, keys: MetricName[]): number => {
  if (!metrics) return 0;
  return keys.reduce((total, key) => {
    const value = metrics[key] ?? 0;
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
};

const getTaskGroup = (
  metrics: Partial<Record<MetricName, number>> | null,
): { group: TaskGroup; automation: number; augmentation: number } => {
  if (!metrics) {
    return { group: "manual", automation: 0, augmentation: 0 };
  }

  const automation = sumMetricGroup(metrics, AUTOMATION_METRICS);
  const augmentation = sumMetricGroup(metrics, AUGMENTATION_METRICS);

  if (automation <= 0 && augmentation <= 0) {
    return { group: "manual", automation, augmentation };
  }

  if (automation >= augmentation) {
    return { group: "automation", automation, augmentation };
  }

  return { group: "augmentation", automation, augmentation };
};

interface TaskSquareProps {
  task: ToolTask;
}

const TaskSquare: React.FC<TaskSquareProps> = ({ task }) => {
  const { group, automation, augmentation } = getTaskGroup(task.metrics ?? null);

  const content = (
    <div className="max-w-[220px] space-y-1 text-left text-[11px]">
      <div className="leading-tight font-semibold text-white">{task.name}</div>
      <div className="text-[10px] tracking-wide text-gray-200 uppercase">
        {group === "manual"
          ? "Manual / no automation signal"
          : group === "automation"
            ? "Automation-aligned"
            : "Augmentation-aligned"}
      </div>
      <div className="text-[10px] text-gray-200">
        Share: {formatPercent(task.task_share_pct, 1)} · Count: {formatCount(task.count)}
      </div>
      {group !== "manual" && (
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-200">
          <span>Automation pool: {formatPercent(automation, 1)}</span>
          <span>Augmentation pool: {formatPercent(augmentation, 1)}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-0.5 text-[10px] text-gray-200">
        {METRIC_DISPLAY_ORDER.map((metric) => (
          <div key={`${task.name}-${metric}`}>
            {metric}: {formatPercent(task.metrics?.[metric], 1)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={clsx(
            "h-4 w-4 transition-transform duration-150 hover:scale-[1.1] focus:scale-[1.1] sm:h-[18px] sm:w-[18px] cursor-pointer",
          )}
          style={{ backgroundColor: TASK_MIX_COLORS[group] }}
          tabIndex={0}
          role="button"
          aria-label={`Task ${task.name}`}
        />
      </TooltipTrigger>
      <TooltipContent>
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

export const OnetRoleMetricsTool: React.FC<{ toolCall: OnetRoleMetricsToolPart }> = ({ toolCall }) => {
  const requestedRoles = toolCall.input?.roles ?? [];
  const payload = (toolCall.output ?? undefined) as OnetRoleMetricsPayload | undefined;
  const roles = payload?.roles ?? [];
  const invalidRoles = payload?.invalid_roles ?? [];

  return (
    <AnimatePresence mode="wait">
      {(toolCall.state === "input-streaming" || toolCall.state === "input-available") && (
        <ToolContainer key="onet-lookup" toolState="input-streaming">
          <div className="flex items-center gap-2">
            <PulsingDot className="size-2" />
            <TextShimmer className="font-medium">Analyzing O*NET roles...</TextShimmer>
            {requestedRoles.length > 0 && (
              <TextShimmer className="text-xs text-gray-500">{requestedRoles.join(", ")}</TextShimmer>
            )}
          </div>
        </ToolContainer>
      )}

      {toolCall.state === "output-available" && (
        <ToolContainer key="onet-result" toolState="output-available">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium">O*NET role insights</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {roles.length} matched · {invalidRoles.length} unmatched
            </span>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {roles.map((role) => {
              const tasks = role.tasks ?? [];
              const sortedTasks = [...tasks].sort((a, b) => {
                const groupA = getTaskGroup(a.metrics ?? null).group;
                const groupB = getTaskGroup(b.metrics ?? null).group;
                const orderA = TASK_GROUP_ORDER.indexOf(groupA);
                const orderB = TASK_GROUP_ORDER.indexOf(groupB);
                if (orderA !== orderB) {
                  return orderA - orderB;
                }
                return (b.task_share_pct ?? 0) - (a.task_share_pct ?? 0);
              });
              const columnEstimate =
                sortedTasks.length <= 30
                  ? Math.max(1, Math.ceil(sortedTasks.length / 3))
                  : Math.min(8, Math.max(3, Math.round(Math.sqrt(sortedTasks.length || 1))));

              const showRequested =
                role.requested && role.requested.trim().toLowerCase() !== role.role.trim().toLowerCase();

              return (
                <div key={role.role} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <div>
                      <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{role.role}</div>
                      <div className="text-[9px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
                        {role.parent_cluster}
                      </div>
                  </div>
                    <div className="text-right">
                      {showRequested && <div>Requested: {role.requested}</div>}
                      <div>Workforce: {formatPercent(role.workforce_share_pct, 2)}</div>
                    </div>
                  </div>

                  {sortedTasks.length > 0 && (
                    <div
                      className="grid justify-start gap-[4px]"
                      style={{ gridTemplateColumns: `repeat(${Math.max(1, columnEstimate)}, max-content)` }}
                    >
                      {sortedTasks.map((task) => (
                        <TaskSquare key={`${role.role}-${task.name}`} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {roles.length === 0 && (
              <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                No matching O*NET roles found.
              </div>
            )}
          </div>

          {invalidRoles.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-100 bg-amber-50/50 p-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle size={12} />
                Could not match some roles
              </div>
              <ul className="space-y-1">
                {invalidRoles.map(({ requested, suggestions, did_you_mean }) => (
                  <li key={requested}>
                    <span className="font-semibold">{requested}</span>
                    {did_you_mean && (
                      <span className="ml-1 text-gray-600 dark:text-gray-300">Did you mean {did_you_mean}?</span>
                    )}
                    {suggestions && suggestions.length > 0 && (
                      <span className="ml-1 text-gray-600 dark:text-gray-300">
                        Try: {suggestions.slice(0, 3).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ToolContainer>
      )}
    </AnimatePresence>
  );
};
