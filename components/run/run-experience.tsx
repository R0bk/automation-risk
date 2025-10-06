"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichedOrgReport } from "@/lib/run/report-schema";
import { enrichedOrgReportSchema, orgReportSchema } from "@/lib/run/report-schema";
import { normaliseLegacyReport } from "@/lib/run/normalize-report";
import { generateUUID, slugifyCompanyName } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { ReportPreview } from "./report-preview";
import { OrgFlowChart } from "./OrgFlowChart";
import { GroupedMessages } from "./messages";
import { StatusBar } from "@/components/run/status-bar";
import { TaskMixViewProvider } from "./task-mix-view-context";
import { ReportStateProvider } from "./report-context";

interface RunExperienceProps {
  slug: string;
  initialName?: string | null;
  refresh?: boolean;
  initialChatId?: string | null;
  initialRunId?: string | null;
  initialStatus?: RunSnapshot["status"];
  initialReport?: EnrichedOrgReport | null;
  initialMessages?: ChatMessage[];
  initialRemainingRuns?: number | null;
}

type RunSnapshot = {
  status: "idle" | "running" | "replay" | "completed" | "failed";
  runId?: string;
  chatId?: string;
  remainingRuns?: number | null;
  companyName?: string;
  error?: string;
};

interface RunStatusResponse {
  status: string;
  runId?: string;
  finalReportJson?: EnrichedOrgReport | null;
  chatId?: string;
  messages?: ChatMessage[];
  company?: {
    displayName?: string;
  };
  remainingRuns?: number | null;
}

interface RunSummaryResponse {
  status: "summary";
  remainingRuns: number | null;
}

type RunRequestPayload = {
  companyName: string;
  hqCountry?: string | null;
  refresh: boolean;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function RunExperience({
  slug,
  initialName,
  refresh = false,
  initialChatId = null,
  initialRunId = null,
  initialStatus = "idle",
  initialReport = null,
  initialMessages = [],
  initialRemainingRuns = null,
}: RunExperienceProps) {
  const searchParams = useSearchParams();

  const [snapshot, setSnapshot] = useState<RunSnapshot>(() => ({
    status: initialStatus,
    runId: initialRunId ?? undefined,
    chatId: initialChatId ?? undefined,
    remainingRuns: initialRemainingRuns ?? null,
    companyName: initialName ?? undefined,
  }));
  const [report, setReport] = useState<EnrichedOrgReport | null>(initialReport);
  const [isPolling, setIsPolling] = useState(false);
  const [chatIdState, setChatIdState] = useState<string | null>(initialChatId);
  const [initialChatMessages, setInitialChatMessages] = useState<ChatMessage[]>(
    initialMessages
  );

  const latestPayloadRef = useRef<RunRequestPayload | null>(null);
  const chatIdRef = useRef<string | null>(initialChatId);
  const bootstrappedRef = useRef(false);
  const pendingTranscriptRef = useRef<ChatMessage[] | null>(
    initialMessages.length > 0 ? initialMessages : null
  );
  const reportSourceRef = useRef<string | null>(null);

  const companyName = useMemo(() => {
    if (initialName && initialName.length > 0) {
      return initialName;
    }

    const fromParam = searchParams.get("name");
    if (fromParam) return fromParam;

    return slug.replace(/-/g, " ");
  }, [initialName, searchParams, slug]);

  const parseReport = useCallback((input: unknown): EnrichedOrgReport | null => {
    if (!input) return null;
    console.log("Parse report:", input)
    const enriched = enrichedOrgReportSchema.safeParse(input);
    console.log("Enriched:", enriched)
    if (enriched.success) {
      return enriched.data;
    }
    console.log("failed to enrich sucessfully")
    const normalized = normaliseLegacyReport(input);
    const normalizedEnriched = enrichedOrgReportSchema.safeParse(normalized);
    if (normalizedEnriched.success) {
      return normalizedEnriched.data;
    }
    const base = orgReportSchema.safeParse(normalized);
    if (base.success) {
      console.warn("[RunExperience] Received base org report without enrichment; ignoring payload");
    }
    return null;
  }, []);

  const fetchRunBySlug = useCallback(async (): Promise<RunStatusResponse | null> => {
    try {
      const response = await fetch(`/api/run?slug=${slug}`, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as RunStatusResponse;
      console.log("[RunExperience] fetchRunBySlug", {
        status: data.status,
        chatId: data.chatId,
        messageCount: data.messages?.length ?? 0,
        data
      });
      return data;
    } catch (error) {
      console.warn("Failed to fetch run by slug", error);
      return null;
    }
  }, [slug]);

  const updateRemainingRuns = useCallback(async () => {
    try {
      const response = await fetch(`/api/run?summary=1`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as RunSummaryResponse;
      setSnapshot((prev) => ({ ...prev, remainingRuns: data.remainingRuns ?? prev.remainingRuns ?? null }));
    } catch (error) {
      console.warn("Unable to refresh remaining run budget", error);
    }
  }, []);

  const {
    messages,
    sendMessage,
    setMessages,
    status: chatStatus,
    error: chatError,
    clearError,
  } = useChat<ChatMessage>({
    id: chatIdState ?? `run-${slug}`,
    generateId: generateUUID,
    messages: initialChatMessages,
    experimental_throttle: 200,
    transport: new DefaultChatTransport({
      api: "/api/run",
      prepareSendMessagesRequest: (request) => {
        if (!latestPayloadRef.current) {
          throw new Error("Missing run payload");
        }
        const payload: Record<string, unknown> = {
          ...latestPayloadRef.current,
        };

        const lastMessage = request.messages.at(-1);
        if (lastMessage) {
          payload.message = lastMessage;
        }

        if (chatIdRef.current) {
          payload.chatId = chatIdRef.current;
        }

        return { body: payload };
      },
    }),
    onError: (error) => {
      setSnapshot((prev) => ({ ...prev, status: "failed", error: error.message }));
    },
    onFinish: () => {
      setSnapshot((prev) => ({ ...prev, status: "completed" }));
      void (async () => {
        await updateRemainingRuns();
        const latest = await fetchRunBySlug();
        console.log("Latest", latest)
        if (latest?.finalReportJson && !report) {
          const parsed = parseReport(latest.finalReportJson);
          if (parsed) {
            setReport(parsed);
          }
        }
        if (latest?.runId || latest?.chatId) {
          setSnapshot((prev) => ({
            ...prev,
            runId: latest?.runId ?? prev.runId,
            chatId: latest?.chatId ?? prev.chatId,
          }));
        }
        if (latest?.messages) {
          applyTranscript({ chatId: latest.chatId, messages: latest.messages });
        }
      })();
    },
  });

  const applyTranscript = useCallback(
    ({ chatId, messages }: { chatId?: string; messages?: ChatMessage[] | null }) => {
      const hasRenderableAssistant = (payload: ChatMessage[]) =>
        payload.some(
          (message) =>
            message.role === "assistant" &&
            (message.parts ?? []).some((part) => {
              if (!part) return false;
              if (part.type === "text" || part.type === "reasoning") return true;
              return typeof part.type === "string" && part.type.startsWith("tool-");
            })
        );

      if (messages && messages.length > 0) {
        console.log("[RunExperience] applyTranscript received", {
          chatId,
          messageCount: messages.length,
          ids: messages.map((message) => message.id),
        });
        pendingTranscriptRef.current = messages;
        if (hasRenderableAssistant(messages)) {
          setInitialChatMessages(messages);
          setMessages(messages);
        }
      }

      if (chatId) {
        setChatIdState(chatId);
      }
    },
    [setMessages]
  );

  const pollRunUntilComplete = useCallback(
    async () => {
      setIsPolling(true);
      try {
        let backoff = 2000;
        for (let attempt = 0; attempt < 10; attempt++) {
          const data = await fetchRunBySlug();
          console.log("Data", data)
          if (!data) break;

          console.log("[RunExperience] pollRun fetch", {
            status: data.status,
            chatId: data.chatId,
            messageCount: data.messages?.length ?? 0,
          });

          applyTranscript({ chatId: data.chatId, messages: data.messages });

          if (data.status === "completed") {
            if (data.finalReportJson) {
              const parsed = parseReport(data.finalReportJson);
              if (parsed) {
                setReport(parsed);
              }
            }

            setSnapshot((prev) => ({
              ...prev,
              status: "completed",
              runId: data.runId ?? prev.runId,
              chatId: data.chatId ?? prev.chatId,
              companyName: data.company?.displayName ?? prev.companyName,
            }));
            await updateRemainingRuns();
            return;
          }

          if (data.status === "failed") {
            setSnapshot((prev) => ({
              ...prev,
              status: "failed",
              runId: data.runId ?? prev.runId,
              chatId: data.chatId ?? prev.chatId,
              companyName: data.company?.displayName ?? prev.companyName,
              error: "Run failed",
            }));
            await updateRemainingRuns();
            return;
          }

          await delay(backoff);
          backoff = Math.min(backoff * 1.5, 15000);
        }
      } finally {
        setIsPolling(false);
      }
    },
    [applyTranscript, fetchRunBySlug, parseReport, updateRemainingRuns]
  );
  useEffect(() => {
    if (chatStatus === "submitted" || chatStatus === "streaming") {
      setSnapshot((prev) =>
        prev.status === "running"
          ? prev
          : {
              ...prev,
              status: "running",
            }
      );
    }
  }, [chatStatus]);

  useEffect(() => {
    chatIdRef.current = chatIdState;
  }, [chatIdState]);

  useEffect(() => {
    console.log("[RunExperience] chatId state", chatIdState);
    console.log("[RunExperience] messages length", messages.length);
  }, [chatIdState, messages.length]);

  useEffect(() => {
    if (!chatIdState) {
      return;
    }

    if (pendingTranscriptRef.current && pendingTranscriptRef.current.length > 0) {
      console.log("[RunExperience] rehydrating transcript after chatId change", {
        chatId: chatIdState,
        count: pendingTranscriptRef.current.length,
        ids: pendingTranscriptRef.current.map((message) => message.id),
      });
      setMessages(pendingTranscriptRef.current);
      pendingTranscriptRef.current = null;
    }
  }, [chatIdState, setMessages]);

  const startRun = useCallback(
    async (override?: { refresh?: boolean }) => {
      if (!companyName) {
        setSnapshot({ status: "failed", error: "Missing company name" });
        return;
      }

      clearError();
      if (override?.refresh ?? refresh) {
        setChatIdState(null);
        chatIdRef.current = null;
      }

      latestPayloadRef.current = {
        companyName,
        hqCountry: undefined,
        refresh: override?.refresh ?? refresh,
      };

      setReport(null);
      setMessages([]);
      pendingTranscriptRef.current = null;
      setInitialChatMessages([]);
      setSnapshot((prev) => ({
        status: "running",
        companyName,
        remainingRuns: prev.remainingRuns ?? null,
      }));

      try {
        await sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: `Run an automation share analysis for ${companyName}.`,
            },
          ],
          metadata: { createdAt: new Date().toISOString() },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Run failed";
        console.error("[RunExperience] sendMessage failed", error);
        setSnapshot({ status: "failed", error: message });
      }
    },
    [clearError, companyName, refresh, sendMessage, setMessages]
  );

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      await updateRemainingRuns();
      if (cancelled) {
        return;
      }

      if (!companyName) {
        bootstrappedRef.current = true;
        setSnapshot({ status: "failed", error: "Missing company name" });
        return;
      }

      if (!refresh) {
        const existing = await fetchRunBySlug();
        console.log("Bootstrap:", existing)
        if (cancelled) return;

        if (existing) {
          console.log("[RunExperience] bootstrap existing status", {
            status: existing.status,
            chatId: existing.chatId,
            messageCount: existing.messages?.length ?? 0,
          });
          applyTranscript({ chatId: existing.chatId, messages: existing.messages });

          if (existing.status === "completed" && existing.finalReportJson) {
            console.log("Bootstrap: completed, trying to parse")
            const parsed = parseReport(existing.finalReportJson);
            if (parsed) {
              setReport(parsed);
            }
            bootstrappedRef.current = true;
            setSnapshot((prev) => ({
              ...prev,
              status: "completed",
              runId: existing.runId,
              chatId: existing.chatId ?? prev.chatId,
              remainingRuns: existing.remainingRuns ?? prev.remainingRuns ?? null,
              companyName: existing.company?.displayName ?? companyName,
            }));
            return;
          }

          if (existing.status === "running" || existing.status === "pending") {
            bootstrappedRef.current = true;
            setSnapshot((prev) => ({
              ...prev,
              status: existing.status as RunSnapshot["status"],
              runId: existing.runId,
              chatId: existing.chatId ?? prev.chatId,
              remainingRuns: existing.remainingRuns ?? prev.remainingRuns ?? null,
              companyName: existing.company?.displayName ?? companyName,
            }));
            await pollRunUntilComplete();
            return;
          }

          // If we got a completed run but without a final report/messages, treat it as hydrated.
          if (existing.status === "completed") {
            bootstrappedRef.current = true;
            return;
          }
        }
      }

      if (cancelled) {
        return;
      }

      if (!cancelled) {
        bootstrappedRef.current = true;
        await startRun({ refresh });
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    applyTranscript,
    companyName,
    fetchRunBySlug,
    initialName,
    pollRunUntilComplete,
    refresh,
    startRun,
    updateRemainingRuns,
  ]);

  useEffect(() => {
    if (chatError && snapshot.status !== "failed") {
      console.error("[RunExperience] chat error observed", chatError);
      setSnapshot((prev) => ({ ...prev, status: "failed", error: chatError.message }));
    }
  }, [chatError, snapshot.status]);

  const statusDisplay = useMemo(() => {
    if (snapshot.status === "failed") {
      return { label: "Failed", tone: "red" } as const;
    }

    if (snapshot.status === "completed") {
      return { label: "Completed", tone: "green" } as const;
    }

    if (chatStatus === "streaming" || chatStatus === "submitted") {
      return { label: "Analyzing", tone: "blue" } as const;
    }

    if (isPolling) {
      return { label: "Finalizing", tone: "blue" } as const;
    }

    if (snapshot.status === "replay") {
      return { label: "Replaying", tone: "violet" } as const;
    }

    return { label: "Ready", tone: "neutral" } as const;
  }, [snapshot.status, chatStatus, isPolling]);

  const isLoading = chatStatus === "submitted" || chatStatus === "streaming";
  const isStreaming = chatStatus === "streaming";
  console.log(snapshot)
  console.log(report)

  const setReportFromTool = useCallback(
    (next: EnrichedOrgReport, sourceId?: string | null) => {
      if (sourceId && reportSourceRef.current === sourceId) {
        return;
      }
      reportSourceRef.current = sourceId ?? null;
      setReport(next);
    },
    [setReport]
  );

  const reportProviderValue = useMemo(
    () => ({
      report,
      setReportFromTool,
    }),
    [report, setReportFromTool]
  );

  return (
    <ReportStateProvider value={reportProviderValue}>
      <TaskMixViewProvider>
        <div className="space-y-10">
      <header
        className="rounded-[20px] border border-[rgba(38,37,30,0.1)] px-7 py-8 shadow-[0_28px_70px_rgba(34,28,20,0.14)] backdrop-blur-[20px]"
        style={{
          backgroundImage: "linear-gradient(150deg, rgba(244,243,239,0.96), rgba(235,233,227,0.9))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-[720px] space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
              Live automation impact run
            </p>
            <h1 className="text-[clamp(32px,4vw,46px)] font-semibold leading-[1.1] text-[#26251e]">
              {companyName || slugifyCompanyName(slug)}
            </h1>
            <p className="text-sm leading-relaxed text-[rgba(38,37,30,0.66)]">
              Streaming AI analysis with native web search, O*NET role alignment, and AnthropX automation/augmentation share overlays. Every insight and tool call is captured in real time.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 text-right">
            {snapshot.remainingRuns != null && (
              <Badge
                variant="outline"
                className="border-[rgba(38,37,30,0.12)] bg-[rgba(38,37,30,0.06)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-[rgba(38,37,30,0.65)]"
              >
                {snapshot.remainingRuns} runs left
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-transparent bg-[rgba(245,78,0,0.08)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f54e00]"
            >
              {statusDisplay.label}
            </Badge>
          </div>
        </div>
        {snapshot.error && (
          <div className="mt-5 rounded-xl border border-[#cf2d5633] bg-[#cf2d5614] px-4 py-3 text-sm text-[#cf2d56]">
            {snapshot.error}
          </div>
        )}
      </header>

      <section className="grid gap-7 lg:grid-cols-[2fr,1fr]">
            {snapshot.status === "completed" && report ? (
          <>
            <div className="flex flex-col gap-5">
              <ReportPreview report={report} />
            </div>

            <div
              className="flex flex-col relative rounded-[20px] border border-[rgba(38,37,30,0.1)] px-5 py-6 shadow-[0_16px_40px_rgba(34,28,20,0.12)] backdrop-blur-[18px]"
              style={{
                backgroundImage: "linear-gradient(160deg, rgba(244,243,239,0.95), rgba(236,234,228,0.9))",
              }}
            >
              <div className="flex flex-1 gap-2">
                <h2
                  id="narrative"
                  className="text-[11px] font-semibold uppercase tracking-[0.32em] leading-[0.5] text-[rgba(38,37,30,0.6)]"
                >
                  Analyst narrative
                </h2>
              </div>
              <div className="mt-4 min-h-[220px] space-y-4 text-sm leading-7 text-[rgba(38,37,30,0.72)]">
                {messages.length > 0 ? (
                  <GroupedMessages messages={messages} statusBar={<StatusBar isLoading={isLoading} isStreaming={isStreaming} />} />
                ) : (
                  <Skeleton className="h-28 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="relative rounded-[20px] border border-[rgba(38,37,30,0.1)] px-5 py-6 shadow-[0_16px_40px_rgba(34,28,20,0.12)] backdrop-blur-[18px]"
              style={{
                backgroundImage: "linear-gradient(160deg, rgba(244,243,239,0.95), rgba(236,234,228,0.9))",
              }}
            >
              
              <h2
                id="narrative"
                className="text-[11px] font-semibold uppercase tracking-[0.32em] leading-[0.5] text-[rgba(38,37,30,0.6)]"
              >
                Analyst narrative
              </h2>
              <div className="mt-4 min-h-[220px] space-y-4 text-sm leading-7 text-[rgba(38,37,30,0.72)]">
                {messages.length > 0 ? (
                  <GroupedMessages messages={messages} statusBar={<StatusBar isLoading={isLoading} isStreaming={isStreaming} />} />
                ) : (
                  <Skeleton className="h-28 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {report && (
                <>
                  <ReportPreview report={report} />
                  <div id="org-chart">
                    <OrgFlowChart report={report} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {snapshot.status === "failed" && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              void startRun({ refresh: true });
            }}
          >
            Retry run
          </Button>
        </div>
      )}
      </div>
      </TaskMixViewProvider>
    </ReportStateProvider>
  );
}
