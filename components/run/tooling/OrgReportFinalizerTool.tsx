import { AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import React from "react";

import { PulsingDot } from "@/components/run/pulsing-dot";
import { ToolContainer } from "@/components/run/tooling/tool-container";
import { ReportPreview } from "../report-preview";
import { orgReportSchema, type OrgReport } from "@/lib/run/report-schema";
import type { ChatMessage } from "@/lib/types";
import { normaliseLegacyReport } from "@/lib/run/normalize-report";

export type OrgReportFinalizerToolPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-org_report_finalizer" }
>;

export const OrgReportFinalizerTool: React.FC<{ toolCall: OrgReportFinalizerToolPart }> = ({ toolCall }) => {
  const raw = toolCall.input;
  const attempt = raw ? orgReportSchema.safeParse(raw) : null;
  const fallback = !attempt?.success && raw ? orgReportSchema.safeParse(normaliseLegacyReport(raw)) : null;
  const report: OrgReport | null = attempt?.success ? attempt.data : fallback?.success ? fallback.data : null;

  return (
    <AnimatePresence mode="wait">
      {(toolCall.state === "input-streaming" || toolCall.state === "input-available") && (
        <ToolContainer key="org-report-finalizing" toolState="input-streaming">
          <div className="flex items-center gap-2 text-sm text-[rgba(38,37,30,0.7)]">
            <PulsingDot />
            Finalizing organisation report...
          </div>
        </ToolContainer>
      )}

      {toolCall.state === "output-available" && (
        <ToolContainer key="org-report-finalized" toolState="output-available">
          <div className="mb-3 flex items-center gap-2 text-sm text-[rgba(38,37,30,0.7)]">
            <CheckCircle2 className="text-emerald-500" size={16} />
            <span className="font-medium">Final organisation automation report</span>
          </div>
          {report ? (
            null
            // <ReportPreview report={report} />
          ) : (
            <div className="rounded-md border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] p-4 text-sm text-[rgba(38,37,30,0.7)]">
              Unable to render report payload. The assistant confirmed completion, but the tool input did not match the expected schema.
            </div>
          )}
        </ToolContainer>
      )}
    </AnimatePresence>
  );
};
