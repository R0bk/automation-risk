import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

const useAnthropic = true;

export const providerWebTools = {
  web_search: useAnthropic ? anthropic.tools.webSearch_20250305({ maxUses: 25 }) : openai.tools.webSearch({ searchContextSize: "medium" }),
  // ...(useAnthropic ? {web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 1 })} : {}),
}