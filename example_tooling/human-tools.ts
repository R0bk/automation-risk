import { tool } from "ai";
import { z } from "zod";

export const humanTools = {
  // (Rob): Added the new claude think took e.g. something like:
  // https://www.anthropic.com/engineering/claude-think-tool
  think: tool({
    description:
      "Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed. For example, if you explore a repo and discover the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective. Alternatively, if you receive some test results, call this tool to brainstorm ways to fix the failing tests.",
    inputSchema: z.object({
      thought: z.string().describe("Your detailed thoughts, reasoning, or brainstorming."),
    }),
    execute: async (params: { thought: string }) => {
      console.debug(`AI THOUGHT: ${params.thought}`);
      return { success: true };
    },
  }),

  repair_tool_call: tool({
    description:
      "This tool will show you an error message and the tool call arguments if you incorrectly call another tool.",
    inputSchema: z.object({
      error: z.string().describe("The detailed tool call error."),
    }),
    execute: async (params: { error: string }) => {
      console.debug(`TOOL CALL REPAIR: ${params.error}`);
      return { success: true };
    },
  }),
};
