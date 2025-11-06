"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";
import type { EnrichedOrgReport } from "@/lib/run/report-schema";
import { enrichedOrgReportSchema, orgReportSchema } from "@/lib/run/report-schema";
import {
  computeWorkforceImpact,
  parseWorkforceMetricData,
  type WorkforceImpactSnapshot,
} from "@/lib/run/workforce-impact";
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
  initialChatId?: string | null;
  initialRunId?: string | null;
  initialStatus?: RunSnapshot["status"];
  initialReport?: EnrichedOrgReport | null;
  initialMessages?: ChatMessage[];
  initialRemainingRuns?: number | null;
  initialWorkforceMetric?: WorkforceImpactSnapshot | null;
}

type RunSnapshot = {
  status: "idle" | "running" | "replay" | "completed" | "failed" | "pending";
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
  metrics?: RunMetricPayload[];
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
  userApiKey?: string;
};

interface RunMetricPayload {
  metricType: string;
  label?: string;
  headcount?: number | null;
  automationShare?: number | null;
  augmentationShare?: number | null;
  data?: unknown;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function RunExperience({
  slug,
  initialName,
  initialChatId,
  initialRunId,
  initialStatus = "idle",
  initialReport,
  initialMessages = [],
  initialRemainingRuns,
  initialWorkforceMetric,
}: RunExperienceProps) {
  const searchParams = useSearchParams();
  const refresh = searchParams.get("refresh") === "1";

  const [snapshot, setSnapshot] = useState<RunSnapshot>(() => ({
    status: initialStatus,
    runId: initialRunId ?? undefined,
    chatId: initialChatId ?? undefined,
    remainingRuns: initialRemainingRuns,
    companyName: initialName ?? undefined,
  }));
  const [report, setReport] = useState<EnrichedOrgReport | null>(initialReport ?? null);
  const [storedWorkforceMetric, setStoredWorkforceMetric] = useState<WorkforceImpactSnapshot | null>(
    initialWorkforceMetric ?? null
  );
  const [isPolling, setIsPolling] = useState(false);
  const [chatIdState, setChatIdState] = useState<string | null>(initialChatId ?? null);
  const [initialChatMessages, setInitialChatMessages] = useState<ChatMessage[]>(
    initialMessages
  );
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  const latestPayloadRef = useRef<RunRequestPayload | null>(null);
  const chatIdRef = useRef<string | null>(initialChatId ?? null);
  const bootstrappedRef = useRef(false);
  const pendingTranscriptRef = useRef<ChatMessage[] | null>(
    initialMessages.length > 0 ? initialMessages : null
  );
  const reportSourceRef = useRef<string | null>(null);
  const narrativeScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickNarrativeRef = useRef(true);

  useEffect(() => {
    if (initialReport && !reportSourceRef.current) {
      reportSourceRef.current = "initial";
    }
  }, [initialReport]);

  const companyName = useMemo(() => {
    if (initialName && initialName.length > 0) return initialName;

    const fromParam = searchParams.get("name");
    if (fromParam) return fromParam;

    return slug.replace(/-/g, " ");
  }, [initialName, searchParams, slug]);

  const applyWorkforceMetric = useCallback(
    (metrics?: RunMetricPayload[] | null) => {
      if (!metrics || metrics.length === 0) return;
      const entry = metrics.find((item) => item.metricType === "workforce_score");
      if (!entry) return;

      const parsed = parseWorkforceMetricData(entry.data, {
        companyName,
        runId: snapshot.runId ?? initialRunId ?? null,
        source: "run-experience",
      });
      if (parsed) setStoredWorkforceMetric(parsed);
    },
    [companyName, snapshot.runId, initialRunId]
  );

  const parseReport = useCallback((input: unknown): EnrichedOrgReport | null => {
    if (!input) return null;
    const enriched = enrichedOrgReportSchema.safeParse(input);
    if (enriched.success) return enriched.data;
    const normalized = normaliseLegacyReport(input);
    const normalizedEnriched = enrichedOrgReportSchema.safeParse(normalized);
    if (normalizedEnriched.success) return normalizedEnriched.data;
    const base = orgReportSchema.safeParse(normalized);
    if (base.success) {
      // Base org report received without enrichment; ignoring payload
    }
    return null;
  }, []);

  const fetchRunBySlug = useCallback(async (): Promise<RunStatusResponse | null> => {
    try {
      const response = await fetch(`/api/run?slug=${slug}`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = (await response.json()) as RunStatusResponse;
      applyWorkforceMetric(data.metrics);
      return data;
    } catch (error) {
      // Failed to fetch run by slug
      return null;
    }
  }, [slug, applyWorkforceMetric]);

  const updateRemainingRuns = useCallback(async () => {
    try {
      const response = await fetch(`/api/run?summary=1`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as RunSummaryResponse;
      setSnapshot((prev) => ({ ...prev, remainingRuns: data.remainingRuns ?? prev.remainingRuns ?? null }));
    } catch (error) {
      // Unable to refresh remaining run budget
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
        const shouldHydrateFromApi = reportSourceRef.current == null;
        if (!shouldHydrateFromApi && snapshot.runId && snapshot.chatId) {
          return;
        }
        const latest = await fetchRunBySlug();
        if (latest?.runId || latest?.chatId) {
          setSnapshot((prev) => ({
            ...prev,
            runId: latest?.runId ?? prev.runId,
            chatId: latest?.chatId ?? prev.chatId,
          }));
        }
        if (shouldHydrateFromApi) {
          if (latest?.finalReportJson) {
            const parsed = parseReport(latest.finalReportJson);
            if (parsed) {
              setReport(parsed);
              reportSourceRef.current = "api";
            }
          }
          if (latest?.messages) {
            applyTranscript({ chatId: latest.chatId, messages: latest.messages });
          }
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
          if (!data) break;

          applyTranscript({ chatId: data.chatId, messages: data.messages });
          applyWorkforceMetric(data.metrics);

          if (data.status === "completed") {
            if (data.finalReportJson) {
              const parsed = parseReport(data.finalReportJson);
              if (parsed) {
                setReport(parsed);
                reportSourceRef.current = "api";
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
    [applyTranscript, applyWorkforceMetric, fetchRunBySlug, parseReport, updateRemainingRuns]
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
    if (!chatIdState) {
      return;
    }

    if (pendingTranscriptRef.current && pendingTranscriptRef.current.length > 0) {
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

      const userApiKey = searchParams.get("apiKey") || undefined;
      latestPayloadRef.current = {
        companyName,
        hqCountry: undefined,
        refresh: override?.refresh ?? refresh,
        userApiKey,
      };

      reportSourceRef.current = null;
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
        // SendMessage failed
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
        // Use server-provided initial data instead of redundant fetch
        // This eliminates the 200ms+ double-fetch penalty

        if (initialStatus === "completed" && initialReport) {
          // Already have complete data from server, no need to fetch
          bootstrappedRef.current = true;
          return;
        }

        if (initialStatus === "running" || initialStatus === "pending") {
          // Server told us it's running, start polling immediately
          bootstrappedRef.current = true;
          setSnapshot((prev) => ({
            ...prev,
            status: initialStatus,
            runId: initialRunId ?? prev.runId,
            chatId: initialChatId ?? prev.chatId,
          }));
          await pollRunUntilComplete();
          return;
        }

        if (initialStatus === "failed") {
          // Server told us it failed, use that state
          bootstrappedRef.current = true;
          return;
        }

        // Only fetch if we don't have initial data from server
        // (e.g., first visit to a company page with no runs yet)
        if (!initialRunId) {
          const existing = await fetchRunBySlug();
          if (cancelled) return;

          if (existing) {
            applyTranscript({ chatId: existing.chatId, messages: existing.messages });
            applyWorkforceMetric(existing.metrics);

            if (existing.status === "completed" && existing.finalReportJson) {
              const parsed = parseReport(existing.finalReportJson);
              if (parsed) {
                setReport(parsed);
                reportSourceRef.current = "api";
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

            if (existing.status === "completed") {
              bootstrappedRef.current = true;
              return;
            }
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
    applyWorkforceMetric,
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
      // Chat error observed
      setSnapshot((prev) => ({ ...prev, status: "failed", error: chatError.message }));
    }
  }, [chatError, snapshot.status]);

  // Record view count
  useEffect(() => {
    if (snapshot.runId && snapshot.status === "completed") {
      navigator.sendBeacon(`/api/run/${snapshot.runId}/view`, "{}");
    }
  }, [snapshot.runId, snapshot.status]);

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

  useEffect(() => {
    const container = narrativeScrollRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom <= 64;
      shouldStickNarrativeRef.current = isNearBottom;
      const hasOverflow = container.scrollHeight > container.clientHeight + 8;
      setShowScrollToLatest((prev) => {
        const next = !isNearBottom && hasOverflow;
        return prev === next ? prev : next;
      });
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [snapshot.status, messages.length]);

  useEffect(() => {
    const container = narrativeScrollRef.current;
    if (!container || !shouldStickNarrativeRef.current) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isStreaming ? "smooth" : "auto",
    });
    setShowScrollToLatest(false);
  }, [messages, isStreaming]);

  const setReportFromTool = useCallback(
    (next: EnrichedOrgReport, sourceId?: string | null) => {
      if (sourceId && reportSourceRef.current === sourceId) {
        return;
      }
      reportSourceRef.current = sourceId ?? "tool";
      setReport(next);
    },
    [setReport]
  );

  const computedWorkforceImpact = useMemo<WorkforceImpactSnapshot | null>(() => {
    if (!report) return null;
    const base = computeWorkforceImpact(report);
    if (!base) return null;
    return { ...base };
  }, [report]);

  const resolvedWorkforceImpact = useMemo<WorkforceImpactSnapshot | null>(() => {
    if (storedWorkforceMetric) {
      const hasSignal =
        (storedWorkforceMetric.automationComponent ?? 0) > 0 ||
        (storedWorkforceMetric.augmentationComponent ?? 0) > 0 ||
        (storedWorkforceMetric.coverageComponent ?? 0) > 0;

      if (hasSignal) {
        return storedWorkforceMetric;
      }
    }

    return computedWorkforceImpact;
  }, [computedWorkforceImpact, storedWorkforceMetric]);

  const reportProviderValue = useMemo(
    () => ({
      report,
      setReportFromTool,
    }),
    [report, setReportFromTool]
  );

  const formatPercent = useCallback((value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
      return "—";
    }
    return `${Math.round(value * 100)}%`;
  }, []);

  const showRunMeta = snapshot.status !== "completed";

  return (
    <ReportStateProvider value={reportProviderValue}>
      <TaskMixViewProvider>
        <div className="space-y-10">
      <header
        className="rounded-[20px] border border-[rgba(38,37,30,0.1)] px-7 py-8 shadow-[0_28px_70px_rgba(34,28,20,0.14)] backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)]"
        style={{
          backgroundImage: "linear-gradient(150deg, rgba(244,243,239,0.96), rgba(235,233,227,0.9))",
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="w-full max-w-full space-y-4 lg:basis-2/3 lg:pr-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
              Live automation impact run
            </p>
            <h1 className="text-[clamp(32px,4vw,46px)] font-semibold leading-[1.1] text-[#26251e]">
              {companyName || slugifyCompanyName(slug)}
            </h1>
            <p className="text-sm leading-relaxed text-[rgba(38,37,30,0.66)]">
              Explore potential AI-driven changes across {companyName}'s workforce. Below our AI Analyst approximates their organizational composition and maps identified roles to occupational standards. Allowing us to estimate automation and augmentation opportunities for different positions.
            </p>
            <p className="text-sm leading-relaxed text-[rgba(38,37,30,0.66)]">
              While these are indicative projections rather than precise measurements, they're grounded in real-world data: task-level usage patterns from Claude interactions analyzed in Anthropic's Economic Index.
            </p>
          </div>
          {resolvedWorkforceImpact && (
            <div className="relative flex w-full max-w-[400px] flex-col items-start gap-4 text-[#26251e] lg:basis-1/3 lg:items-end lg:text-right">
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.58)]">
                Potential workforce impact score
              </span>
              <div className="relative flex w-full flex-col items-start gap-3 lg:items-end">
                <div className="relative w-full overflow-visible">
                  <span className="pointer-events-none block text-[clamp(120px,10vw,180px)] font-semibold leading-[0.8] text-[rgba(38,37,30,0.08)]">
                    {(() => {
                      const value = resolvedWorkforceImpact.score * 10;
                      return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
                    })()}
                  </span>
                  <span className="absolute inset-0 flex items-end justify-between gap-4 px-1 pb-1 text-[clamp(52px,5vw,68px)] font-semibold leading-none text-[#26251e] lg:justify-end">
                    <span className="whitespace-nowrap">
                      {(() => {
                        const value = resolvedWorkforceImpact.score * 10;
                        return value >= 10 ? `${Math.round(value)}%` : `${value.toFixed(1)}%`;
                      })()}
                    </span>
                    {/* <span className="text-2xl font-semibold text-[rgba(38,37,30,0.55)]">/10</span> */}
                  </span>
                </div>
                <ul className="flex flex-col gap-2 text-xs text-[rgba(38,37,30,0.75)] lg:items-end">
                  <li className="inline-flex items-baseline gap-2 uppercase tracking-[0.18em]">
                    <span className="font-semibold text-[rgba(38,37,30,0.6)]">Automation</span>
                    <span className="font-mono text-sm text-[#cf2d56]">
                      {formatPercent(resolvedWorkforceImpact.automationComponent)}
                    </span>
                  </li>
                  <li className="inline-flex items-baseline gap-2 uppercase tracking-[0.18em]">
                    <span className="font-semibold text-[rgba(38,37,30,0.6)]">Augmentation</span>
                    <span className="font-mono text-sm text-[#2d6fce]">
                      {formatPercent(resolvedWorkforceImpact.augmentationComponent)}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
          {showRunMeta && (
            <div className="flex flex-col items-end gap-2 text-right lg:ml-6">
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
          )}
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
              <ReportPreview report={report} impact={resolvedWorkforceImpact} />
            </div>

            <div
              className="flex flex-col relative rounded-[20px] border border-[rgba(38,37,30,0.1)] px-5 py-6 shadow-[0_16px_40px_rgba(34,28,20,0.12)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
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
              <div className="mt-4 relative">
                <div
                  ref={narrativeScrollRef}
                  className="min-h-[220px] max-h-[520px] overflow-y-auto pr-2 text-sm leading-7 text-[rgba(38,37,30,0.72)]"
                >
                  {messages.length > 0 ? (
                    <GroupedMessages messages={messages} />
                  ) : (
                    <Skeleton className="h-28 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
                  )}
                </div>
                <div className="pointer-events-none absolute left-0 right-0 -top-5 z-20 flex justify-center">
                  <div className="relative">
                    <StatusBar isLoading={isLoading} isStreaming={isStreaming} />
                  </div>
                </div>
                {showScrollToLatest && (
                  <button
                    type="button"
                    aria-label="Scroll to latest analyst updates"
                    onClick={() => {
                      const container = narrativeScrollRef.current;
                      if (!container) return;
                      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                      shouldStickNarrativeRef.current = true;
                      setShowScrollToLatest(false);
                    }}
                    className="absolute bottom-4 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(38,37,30,0.14)] bg-white text-[rgba(38,37,30,0.72)] shadow-[0_12px_28px_rgba(34,28,20,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(34,28,20,0.22)] focus:outline-none focus:ring-2 focus:ring-[#f54e00]/50 focus:ring-offset-1"
                  >
                    <ChevronDown size={18} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="relative rounded-[20px] border border-[rgba(38,37,30,0.1)] px-5 py-6 shadow-[0_16px_40px_rgba(34,28,20,0.12)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
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
              <div className="mt-4 relative">
                <div
                  ref={narrativeScrollRef}
                  className="min-h-[220px] max-h-[520px] overflow-y-auto pr-2 text-sm leading-7 text-[rgba(38,37,30,0.72)]"
                >
                  {messages.length > 0 ? (
                    <GroupedMessages messages={messages} />
                  ) : (
                    <Skeleton className="h-28 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />
                  )}
                </div>
                <div className="pointer-events-none absolute left-0 right-0 -top-5 z-20 flex justify-center">
                  <div className="relative">
                    <StatusBar isLoading={isLoading} isStreaming={isStreaming} />
                  </div>
                </div>
                {showScrollToLatest && (
                  <button
                    type="button"
                    aria-label="Scroll to latest analyst updates"
                    onClick={() => {
                      const container = narrativeScrollRef.current;
                      if (!container) return;
                      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                      shouldStickNarrativeRef.current = true;
                      setShowScrollToLatest(false);
                    }}
                    className="absolute bottom-4 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(38,37,30,0.14)] bg-white text-[rgba(38,37,30,0.72)] shadow-[0_12px_28px_rgba(34,28,20,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(34,28,20,0.22)] focus:outline-none focus:ring-2 focus:ring-[#f54e00]/50 focus:ring-offset-1"
                  >
                    <ChevronDown size={18} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {report && (
                <>
                  <ReportPreview report={report} impact={resolvedWorkforceImpact} />
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
