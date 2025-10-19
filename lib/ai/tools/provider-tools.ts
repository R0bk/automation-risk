import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

import { getExaSearchTool } from "./exa-tools";

const useAnthropic = true;
const exaApiKey = process.env.EXA_API_KEY ?? "";

export const providerWebTools = exaApiKey
  ? {
      exa_search: getExaSearchTool({ exaApiKey }),
    }
  : {
      web_search: useAnthropic
        ? anthropic.tools.webSearch_20250305({ maxUses: 25 })
        : openai.tools.webSearch({ searchContextSize: "medium" }),
      // ...(useAnthropic ? {web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 1 })} : {}),
    };
