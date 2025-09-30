import { NextResponse } from "next/server";
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import {
  JsonToSseTransformStream,
  ToolSet,
  createUIMessageStream,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { humanTools } from "@/lib/ai/tools/human-tools";
import { getOnetRoleTools } from "@/lib/ai/tools/onet-tools";
import { runSystemPrompt } from "@/lib/ai/run/prompts";
import {
  createAnalysisRunWithBudget,
  getAnalysisRunById,
  getCompanyBySlug,
  getLatestRunForCompany,
  getMessagesByChatId,
  getRemainingCompanyRuns,
  listTrendingRuns,
  recordRunPopularity,
  saveMessages,
  updateAnalysisRunResult,
  updateAnalysisRunStatus,
} from "@/lib/db/queries";
import {
  enrichedOrgReportSchema,
  orgReportSchema,
  type EnrichedOrgReport,
} from "@/lib/run/report-schema";
import { enrichReportWithJobRoles } from "@/lib/run/enrich-report";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages, slugifyCompanyName } from "@/lib/utils";
import { getRunCache, setRunCache } from "@/lib/cache/run-cache";
import { enforceRunRateLimit } from "@/lib/rate-limit";
import { runRequestSchema } from "./schema";
import { createLongTimeoutFetch } from "@/lib/http/long-timeout-fetch";
import { generateUUID } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 240;

const openaiBaseUrl = process.env.OPENAI_BASE_URL;
const openaiApiKey = process.env.OPENAI_API_KEY;

const THIRTY_MINUTES_IN_MS = 30 * 60_000;

if (!openaiApiKey) {
  console.warn("OPENAI_API_KEY is not set. /api/run will fail until configured.");
}

const openai = openaiApiKey
  ? createOpenAI({
      apiKey: openaiApiKey,
      fetch: createLongTimeoutFetch(THIRTY_MINUTES_IN_MS),
      ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
    })
  : null;

const openaiProviderOptions: OpenAIResponsesProviderOptions = {
  reasoningSummary: "detailed", // 'auto' for condensed or 'detailed' for comprehensive
  serviceTier: "priority",
} satisfies OpenAIResponsesProviderOptions;


function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [ip] = forwarded.split(",");
    if (ip) return ip.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(request: Request) {
  if (!openai) {
    return new ChatSDKError("server_error:api", "OpenAI configuration missing").toResponse();
  }

  let body: z.infer<typeof runRequestSchema>;

  try {
    const json = await request.json();
    body = runRequestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "bad_request:validation", cause: error.issues },
        { status: 400 }
      );
    }

    return new ChatSDKError("bad_request:api", "Invalid JSON payload").toResponse();
  }

  const { companyName, hqCountry, refresh, message } = body;
  const companySlug = slugifyCompanyName(companyName);

  const requestIp = getClientIp(request);
  const existingCompany = await getCompanyBySlug(companySlug);
  if (existingCompany && !refresh) {
    const latestRun = await getLatestRunForCompany(existingCompany.id);
    if (latestRun) {
      if (latestRun.status === "completed") {
        const remaining = await getRemainingCompanyRuns();
        return NextResponse.json(
          {
            status: "replay",
            runId: latestRun.id,
            chatId: latestRun.chatId,
            company: {
              id: existingCompany.id,
              slug: existingCompany.slug,
              displayName: existingCompany.displayName,
              hqCountry: existingCompany.hqCountry,
              lastRunAt: latestRun.updatedAt,
            },
            remainingRuns: remaining,
          },
          { status: 200 }
        );
      }

      if (latestRun.status === "pending" || latestRun.status === "running") {
        const updatedAt = latestRun.updatedAt
          ? new Date(latestRun.updatedAt)
          : null;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);

        if (updatedAt && updatedAt < thirtyMinutesAgo) {
          console.warn(
            "Marking stale analysis run as failed to allow new execution",
            latestRun.id,
            updatedAt.toISOString()
          );
          await updateAnalysisRunStatus(latestRun.id, "failed");
        } else {
          const remaining = await getRemainingCompanyRuns();
          return NextResponse.json(
            {
              status: "in_progress",
              runId: latestRun.id,
              chatId: latestRun.chatId,
              company: {
                id: existingCompany.id,
                slug: existingCompany.slug,
                displayName: existingCompany.displayName,
                hqCountry: existingCompany.hqCountry,
              },
              remainingRuns: remaining,
            },
            { status: 202 }
          );
        }
      }
    }
  }

  const rateLimit = enforceRunRateLimit(requestIp);
  
  //TODO BEFORE PRODUCTION ---- TURN BACK ON
  // if (!rateLimit.allowed) {
  //   return NextResponse.json(
  //     {
  //       code: "rate_limit:run",
  //       cause: "Too many new company runs from this network",
  //       retryAfterMs: rateLimit.retryAfterMs,
  //     },
  //     { status: 429 }
  //   );
  // }

  const { run, company, chatId, remainingRuns } = await createAnalysisRunWithBudget({
    slug: companySlug,
    displayName: companyName,
    hqCountry: hqCountry ?? null,
    inputQuery: companyName,
    model: "gpt-5",
  });

  await updateAnalysisRunStatus(run.id, "running");

  const persistedMessageIds = new Set<string>();

  if (message) {
    const createdAt = message.metadata?.createdAt
      ? new Date(message.metadata.createdAt)
      : new Date();
    const validCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

    await saveMessages({
      messages: [
        {
          id: message.id,
          role: message.role,
          parts: message.parts,
          createdAt: validCreatedAt,
          attachments: [],
          chatId,
        },
      ],
    });

    persistedMessageIds.add(message.id);
  }

  const webSearch = openai.tools.webSearch({ searchContextSize: "medium" });
  const onetTools = getOnetRoleTools();

  let finalReport: EnrichedOrgReport | null = null;

  const orgReportCollector = tool({
    description:
      "Finalize the organisation automation impact report. Call exactly once after gathering evidence.",
    inputSchema: orgReportSchema,
    execute: async (input) => {
      try {
        finalReport = await enrichReportWithJobRoles(input);
      } catch (error) {
        console.error("Failed to enrich report with O*NET roles", error);
        const fallback = enrichedOrgReportSchema.safeParse(input);
        finalReport = fallback.success ? fallback.data : null;
      }
      return { status: "accepted" };
    },
  });

  const tools = {
    web_search: webSearch,
    ...humanTools,
    ...onetTools,
    org_report_finalizer: orgReportCollector,
  } as ToolSet;

  const uiStream = createUIMessageStream({
    execute: ({ writer }) => {
      let hasFinalized = false;

      const finalizeRun = async (
        status: "completed" | "failed",
        message?: string
      ) => {
        if (hasFinalized) return;
        hasFinalized = true;

        try {
          if (status === "completed" && finalReport) {
            await updateAnalysisRunResult({
              runId: run.id,
              status: "completed",
              finalReportJson: finalReport,
            });

            setRunCache({
              runId: run.id,
              slug: company.slug,
              chatId,
              report: finalReport,
              updatedAt: Date.now(),
            });
          } else {
            await updateAnalysisRunResult({
              runId: run.id,
              status: "failed",
              finalReportJson: null,
            });
          }
        } catch (error) {
          console.error("/api/run finalize error", error);
        }
      };

      const handleFailure = async (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        await finalizeRun("failed", message);
      };

      const result = streamText({
        model: openai("gpt-5-mini"),
        system: runSystemPrompt({
          companyName,
          companySlug,
          hqCountry: hqCountry ?? null,
        }),
        stopWhen: stepCountIs(30),
        prompt: `Target company: ${companyName}`,
        tools,
        maxRetries: 3,
        providerOptions: { openai: openaiProviderOptions },
        experimental_transform: smoothStream(),
        experimental_repairToolCall: async ({ toolCall, inputSchema }) => {
          const prompt = [
            `The model tried to call the tool "${toolCall.toolName}" with the following arguments:`,
            JSON.stringify(toolCall.input),
            `The tool accepts the following schema:`,
            JSON.stringify(inputSchema(toolCall)),
            "Please fix the arguments.",
          ].join("\n");

          return {
            ...toolCall,
            toolName: "repair_tool_call",
            input: JSON.stringify({ error: prompt }), // v5 expects input as string
          } as const;
        },
        onError: async ({ error }) => {
          await handleFailure(error);
        },
        onFinish: async () => {
          if (!finalReport) {
            await finalizeRun(
              "failed",
              "Report generation ended without finalizer call."
            );
            return;
          }

          await finalizeRun("completed");
        },
      });

      result.consumeStream();

      writer.merge(
        result.toUIMessageStream({
          sendReasoning: true,
        })
      );

      // result.consumeStream().catch(handleFailure);
    },
    generateId: generateUUID,
    onFinish: async ({ messages }) => {
      if (!messages.length) {
        return;
      }

      const messagesToPersist = messages.filter((currentMessage) => {
        if (persistedMessageIds.has(currentMessage.id)) {
          return false;
        }
        persistedMessageIds.add(currentMessage.id);
        return true;
      });

      console.log("[/api/run] stream onFinish", {
        chatId,
        incomingMessages: messages.length,
        toPersist: messagesToPersist.length,
      });

      if (messagesToPersist.length > 0) {
      await saveMessages({
        messages: messagesToPersist.map((currentMessage) => {
          const createdAtValue = currentMessage.metadata?.createdAt
            ? new Date(currentMessage.metadata.createdAt)
            : new Date();
          const safeCreatedAt = Number.isNaN(createdAtValue.getTime())
            ? new Date()
            : createdAtValue;

          return {
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: safeCreatedAt,
            attachments: [],
            chatId,
          };
        }),
      });

      console.log("[/api/run] persisted messages", {
        chatId,
        ids: messagesToPersist.map((message) => message.id),
      });
    }
  },
    onError: (error) => {
      console.error("/api/run stream error", error);
      return "Oops, an error occurred!";
    },
  });

  return new Response(uiStream.pipeThrough(new JsonToSseTransformStream()));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summary = searchParams.get("summary");

  if (summary === "1") {
    const remainingRuns = await getRemainingCompanyRuns();
    const trending = await listTrendingRuns(8);

    return NextResponse.json({
      status: "summary",
      remainingRuns,
      trending: trending.map((entry) => ({
        runId: entry.runId,
        slug: entry.slug,
        displayName: entry.displayName,
        status: entry.status,
        viewCount: entry.viewCount ?? 0,
        updatedAt: entry.updatedAt,
      })),
    });
  }

  const runId = searchParams.get("runId");
  const slug = searchParams.get("slug");

  if (!runId && !slug) {
    return NextResponse.json(
      { code: "bad_request:api", cause: "Provide runId or slug" },
      { status: 400 }
    );
  }

  if (runId) {
    const cached = getRunCache(runId);
    if (cached && cached.report) {
      return NextResponse.json({
        status: "completed",
        runId: cached.runId,
        finalReportJson: cached.report,
        chatId: cached.chatId,
      });
    }
  }

  if (!runId && slug) {
    const cached = getRunCache(slug);
    if (cached && cached.report) {
      return NextResponse.json({
        status: "completed",
        runId: cached.runId,
        finalReportJson: cached.report,
        chatId: cached.chatId,
      });
    }
  }

  const runRecord = runId
    ? await getAnalysisRunById(runId)
    : slug
    ? await (async () => {
        const companyRecord = await getCompanyBySlug(slug);
        if (!companyRecord) return null;
        return getLatestRunForCompany(companyRecord.id);
      })()
    : null;

  if (!runRecord) {
    return NextResponse.json(
      { code: "not_found:run", cause: "Run not found" },
      { status: 404 }
    );
  }

  if (runRecord.status !== "completed") {
    return NextResponse.json({
      status: runRecord.status,
      runId: runRecord.id,
    });
  }

  console.log("[/api/run] GET completed run", {
    runId: runRecord.id,
    chatId: runRecord.chatId,
  });

  await recordRunPopularity(runRecord.id).catch(() => undefined);

  if (runRecord.finalReportJson) {
    const parsed = enrichedOrgReportSchema.safeParse(runRecord.finalReportJson);
    if (parsed.success) {
      setRunCache({
        runId: runRecord.id,
        slug: slug ?? undefined,
        chatId: runRecord.chatId,
        report: parsed.data,
        updatedAt: Date.now(),
      });
    }
  }

  let messagesPayload = [] as ReturnType<typeof convertToUIMessages>;

  try {
    const storedMessages = await getMessagesByChatId({ id: runRecord.chatId });
    console.log("[/api/run] GET stored messages", {
      runId: runRecord.id,
      chatId: runRecord.chatId,
      count: storedMessages.length,
    });
    messagesPayload = convertToUIMessages(storedMessages);
  } catch (error) {
    console.warn("Failed to load stored run messages", {
      runId: runRecord.id,
      chatId: runRecord.chatId,
      error,
    });
  }

  console.log("[/api/run] GET response payload", {
    runId: runRecord.id,
    chatId: runRecord.chatId,
    messageCount: messagesPayload.length,
    isArray: Array.isArray(messagesPayload),
  });

  return NextResponse.json({
    status: "completed",
    runId: runRecord.id,
    finalReportJson: runRecord.finalReportJson,
    chatId: runRecord.chatId,
    messages: messagesPayload,
  });
}
