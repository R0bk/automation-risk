import type { InferUITool, InferUITools, UIMessage, Tool } from "ai";
import { z } from "zod";
import type { AppUsage } from "./usage";
import type { getOnetRoleTools } from "@/lib/ai/tools/onet-tools";
import type { humanTools } from "@/lib/ai/tools/human-tools";
import { openai } from "@ai-sdk/openai";
import { enrichedOrgReportSchema, orgReportSchema } from "./run/report-schema";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type OnetRoleTools = InferUITools<ReturnType<typeof getOnetRoleTools>>;
type HumanTools = InferUITools<typeof humanTools>;
type WebSearchTool = InferUITool<ReturnType<typeof openai.tools.webSearch>>;
type OrgReportFinalizeTool = Tool<
  z.infer<typeof orgReportSchema>,
  { status: string; report?: z.infer<typeof enrichedOrgReportSchema> }
>;

export type ChatTools = {
  onet_role_metrics: OnetRoleTools["onet_role_metrics"];
  onet_role_summary: OnetRoleTools["onet_role_summary"];
  org_report_finalizer: InferUITool<OrgReportFinalizeTool>;
  think: HumanTools["think"];
  repair_tool_call: HumanTools["repair_tool_call"];
  web_search: WebSearchTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  clear: null;
  finish: null;
  usage: AppUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
