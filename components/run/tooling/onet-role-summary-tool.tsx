import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";

import { TextShimmer } from "../../text-shimmer";
import { ToolContainer } from "./tool-container";
import type { ChatMessage } from "@/lib/types";
import { TaskMixLine } from "@/components/run/TaskMixLine";
import type { TaskMixCounts } from "@/lib/constants/task-mix";
import { PulsingDot } from "@/components/run/pulsing-dot";
import { ChevronRight } from "lucide-react";
import { Scroller } from "@/components/ui/scroller";

type OnetRoleSummaryToolPart = Extract<ChatMessage["parts"][number], { type: "tool-onet_role_summary" }>;

type SummaryPayload = {
  roles?: {
    requested: string;
    role: string;
    onet_code?: string | null;
    parent_cluster: string;
    automation_task_count: number;
    augmentation_task_count: number;
    manual_task_count?: number;
    no_signal_task_count?: number;
    task_count: number;
  }[];
  invalid_roles?: {
    requested: string;
    suggestions?: string[];
    did_you_mean?: string;
  }[];
};

export const OnetRoleSummaryTool: React.FC<{ toolCall: OnetRoleSummaryToolPart }> = ({ toolCall }) => {
  const requestedRoles = toolCall.input?.roles ?? [];
  const payload = (toolCall.output ?? undefined) as SummaryPayload | undefined;
  const roles = payload?.roles ?? [];
  const invalidRoles = payload?.invalid_roles ?? [];
  const [expanded, setExpanded] = useState(true);

  return (
    <AnimatePresence mode="wait">
      {(toolCall.state === "input-streaming" || toolCall.state === "input-available") && (
        <ToolContainer key="onet-summary-input" toolState="input-streaming">
          <div className="flex items-center gap-2">
            <PulsingDot className="size-2" />
            <TextShimmer className="font-medium">Summarizing O*NET roles...</TextShimmer>
            {requestedRoles.length > 0 && (
              <TextShimmer className="text-xs text-gray-500">{requestedRoles.join(", ")}</TextShimmer>
            )}
          </div>
        </ToolContainer>
      )}

      {toolCall.state === "output-available" && (
        <ToolContainer key="onet-summary-result" toolState="output-available">
          <div className="mb-1 flex items-center gap-2">
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} children={<ChevronRight size={14} />} />
            <span className="font-medium">O*NET high-level summary</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {roles.length} matched · {invalidRoles.length} unmatched
            </span>
          </div>

          <div className="mt-1 ml-[7px] border-l border-gray-300 pl-3 flex flex-col cursor-pointer items-center" onClick={() => setExpanded(!expanded)}>
          <Scroller className="max-h-[600px] w-full" orientation="vertical" size={100} offset={50} >
            <div className=" grid gap-5 md:grid-cols-2 w-full">
              {roles.map((role) => {
                const showRequested =
                  role.requested && role.requested.trim().toLowerCase() !== role.role.trim().toLowerCase();

                const mix: TaskMixCounts = {
                  automation: role.automation_task_count ?? 0,
                  augmentation: role.augmentation_task_count ?? 0,
                  manual: role.manual_task_count ?? role.no_signal_task_count ?? 0,
                };

                return (
                  <div key={role.role} className="space-y-1 mt-2">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{role.role}</div>
                          
                        </div>
                        {showRequested && <div className="text-right">Requested: {role.requested}</div>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[9px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
                          {role.parent_cluster}
                        {role.onet_code && (
                            <span className="text-[9px] ml-3 uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              {role.onet_code}
                            </span>
                          )}
                        </div>
                        <div className="text-right">{role.task_count} tasks</div>
                      </div>
                    </div>
                    <TaskMixLine counts={mix} height={8} />
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
              <div className="mt-3 self-start rounded-md border border-amber-200 bg-amber-50/50 p-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="mb-1 font-medium">Could not match some roles</div>
                <ul className="space-y-1">
                  {invalidRoles.map(({ requested, suggestions, did_you_mean }) => (
                    <li key={requested}>
                      <span className="font-semibold">{requested}</span>
                      {did_you_mean && <span className="ml-1 text-gray-600 dark:text-gray-300">Did you mean {did_you_mean}?</span>}
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
            </Scroller>
          </div>
        </ToolContainer>
      )}
    </AnimatePresence>
  );
};
