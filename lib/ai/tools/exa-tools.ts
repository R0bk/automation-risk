import { tool } from "ai";
import { z } from "zod";

const EXA_API_BASE_URL = "https://api.exa.ai";
const DEFAULT_NUM_RESULTS = 10;
const DEFAULT_MAX_CHARACTERS = 3000;

interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string | null;
  author?: string | null;
  score?: number;
  id: string;
  image?: string | null;
  favicon?: string | null;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
}

interface ExaApiResponse {
  requestId: string;
  resolvedSearchType?: string;
  results?: ExaResult[];
  autopromptString?: string;
  error?: string;
}

type LLMExaResponse = Pick<ExaApiResponse, "results" | "error" | "resolvedSearchType" | "autopromptString">;

async function callExaAPI({
  endpoint,
  body,
  exaApiKey,
}: {
  endpoint: string;
  body: object;
  exaApiKey: string;
}): Promise<LLMExaResponse> {
  if (!exaApiKey) {
    throw new Error("Missing Exa API key");
  }

  try {
    const response = await fetch(`${EXA_API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": exaApiKey },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Exa API Error (${response.status}): ${errorText}`);
      throw new Error(`Exa API request failed with status ${response.status}: ${errorText}`);
    }

    const { requestId: _requestId, ...rest } = (await response.json()) as ExaApiResponse;
    return rest;
  } catch (error) {
    console.error("Error calling Exa API:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

const callExaSearch = async ({
  query,
  numResults,
  includedDomains,
  category,
  exaApiKey,
}: {
  query: string;
  numResults?: number;
  includedDomains?: string[];
  category?: string;
  exaApiKey: string;
}) =>
  callExaAPI({
    endpoint: "/search",
    body: {
      query,
      type: "auto",
      ...(category ? { category } : {}),
      ...(includedDomains ? { includeDomains: includedDomains } : {}),
      numResults: numResults ?? DEFAULT_NUM_RESULTS,
      contents: {
        text: {
          maxCharacters: DEFAULT_MAX_CHARACTERS,
        },
        livecrawl: "always",
      },
    },
    exaApiKey,
  });

export const getExaSearchTool = ({ exaApiKey }: { exaApiKey: string }) =>
  tool({
    description:
      "Perform a simple web search using the Exa API to find information relevant to a query. Returns text content directly.",
    inputSchema: z.object({
      query: z.string().describe("The search query."),
      numResults: z
        .number()
        .optional()
        .describe("Number of search results to return (default: 10)."),
      includedDomains: z
        .array(z.string().url())
        .optional()
        .describe("An array of one or more domains to prioritise."),
      explanation: z.string().optional().describe("One sentence explanation as to why this tool is being used."),
    }),
    execute: async ({ explanation: _explanation, ...params }) => {
      const response = await callExaSearch({ ...params, exaApiKey });

      if (response.error) {
        throw new Error(response.error);
      }

      return (response.results ?? []).map((result) => ({
        title: result.title ?? result.url,
        url: result.url,
        summary: result.summary ?? result.text ?? undefined,
        publishedAt: result.publishedDate ?? undefined,
        author: result.author ?? undefined,
      }));
    },
  });
