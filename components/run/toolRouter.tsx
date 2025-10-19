import React from "react";
import type { ChatMessage } from "@/lib/types";
import { ThinkingTool } from "@/components/run/tooling/thinking-tool";
import { OnetRoleMetricsTool } from "@/components/run/tooling/onet-role-metrics-tool";
import { OnetRoleSummaryTool } from "@/components/run/tooling/onet-role-summary-tool";
import { OrgReportFinalizerTool } from "./tooling/OrgReportFinalizerTool";
import { WebSearchCard } from "./tooling/web-search-card";

export type ChatMessagePart = ChatMessage["parts"][number];

export type ToolPart =
  | Extract<ChatMessagePart, { type: `tool-${string}` }>
  | Extract<ChatMessagePart, { type: "dynamic-tool" }>;

export function isToolPart(part: ChatMessagePart): part is ToolPart {
  if (!part) return false;
  if (part.type === "dynamic-tool") return true;
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

export function ToolRenderer({ part }: {part: ToolPart}): React.ReactNode {
  if (part.type === "dynamic-tool") {
    return null;
  }

  const toolName = part.type.replace("tool-", "");
  const fallbackKey = part.toolCallId ?? `${toolName}-${Math.random().toString(36).slice(2)}`;

  switch (part.type) {
    case "tool-think":
      return (
        <ThinkingTool
          key={fallbackKey}
          toolCall={part}
        />
      );
    case "tool-onet_role_metrics":
      return (
        <OnetRoleMetricsTool
          key={fallbackKey}
          toolCall={part}
        />
      );
    case "tool-onet_role_summary":
      return (
        <OnetRoleSummaryTool
          key={fallbackKey}
          toolCall={part}
        />
      );
    case "tool-web_search":
    case "tool-exa_search":
      return (
        <WebSearchCard
          key={fallbackKey}
          args={part.input}
          result={part.state === "output-available" ? part.output : undefined}
          state={part.state}
          error={part.state === "output-error" ? part.errorText : undefined}
        />
      );
    case "tool-org_report_finalizer":
      return (
        <OrgReportFinalizerTool
          key={fallbackKey}
          toolCall={part}
        />
      );
    default:
      return (
        <WebSearchCard
          key={fallbackKey}
          args={part.input}
          result={part.state === "output-available" ? part.output : undefined}
          state={part.state}
          error={part.state === "output-error" ? part.errorText : undefined}
          title={toolName}
        />
      );
  }
}
