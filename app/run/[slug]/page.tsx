import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RunExperience } from "@/components/run/run-experience";
import { SiteFooter } from "@/components/site-footer";
import {
  getCompanyBySlug,
  getLatestRunForCompany,
  getMessagesByChatId,
  getRemainingCompanyRuns,
} from "@/lib/db/queries";
import { orgReportSchema, type OrgReport } from "@/lib/run/report-schema";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";

type RunPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ name?: string; refresh?: string }>;
}

export default async function RunPage({ params, searchParams }: RunPageProps) {
  const { slug } = await params;
  const { name, refresh: refreshParam } = await searchParams;

  const initialNameParam = name ?? undefined;
  const refresh = refreshParam === "1";

  let initialChatId: string | null = null;
  let initialRunId: string | null = null;
  let initialStatus: "idle" | "running" | "replay" | "completed" | "failed" = "idle";
  let initialReport: OrgReport | null = null;
  let initialMessages: ChatMessage[] = [];
  let initialRemainingRuns: number | null = null;

  let fallbackDisplayName: string | undefined;

  try {
    const company = await getCompanyBySlug(slug);
    initialRemainingRuns = await getRemainingCompanyRuns();

    if (company && !refresh) {
      fallbackDisplayName = company.displayName ?? undefined;
      const latestRun = await getLatestRunForCompany(company.id);

      if (latestRun) {
        initialRunId = latestRun.id;
        initialChatId = latestRun.chatId;
        if (latestRun.status === "completed" || latestRun.status === "running") {
          initialStatus = latestRun.status;
        } else if (latestRun.status === "failed") {
          initialStatus = "failed";
        } else {
          initialStatus = "idle";
        }

        if (latestRun.finalReportJson && latestRun.status === "completed") {
          const parsedReport = orgReportSchema.safeParse(latestRun.finalReportJson);
          initialReport = parsedReport.success ? parsedReport.data : null;
        }

        if (latestRun.chatId) {
          const storedMessages = await getMessagesByChatId({ id: latestRun.chatId });
          initialMessages = convertToUIMessages(storedMessages);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to preload run experience", { slug, error });
  }

  const resolvedInitialName = initialNameParam ?? fallbackDisplayName;
  const footerLinks = [
    { label: "Main site", href: "/" },
    { label: "Narrative", href: "#narrative" },
    { label: "Org chart", href: "#org-chart" },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      id="top"
      style={{ backgroundColor: "#f7f7f4" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_rgba(31,138,101,0.08),_transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27 fill=%27none%27 viewBox=%270 0 120 120%27%3E%3Cpath stroke=%27%2326251e%27 stroke-opacity=%270.2%27 stroke-width=%270.6%27 d=%27M60 0v120M0 60h120%27/%3E%3C/svg%3E')",
          }}
        />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-32 pt-12 text-[#26251e]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.28em] text-[rgba(38,37,30,0.55)]">
          <Link
            aria-label="Back to main page"
            className="group inline-flex h-9 items-center justify-center rounded-full border border-transparent bg-transparent px-3 text-[rgba(38,37,30,0.55)] transition-all duration-200 hover:border-[rgba(38,37,30,0.18)] hover:bg-[rgba(255,255,252,0.75)] hover:text-[#f54e00]"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="ml-2 text-[10px] uppercase tracking-[0.32em] text-[rgba(38,37,30,0.42)] transition-colors duration-200 group-hover:text-[#f54e00]">
              Main Page
            </span>
          </Link>
          {resolvedInitialName && (
            <span className="font-mono text-[rgba(38,37,30,0.45)]">
              Viewing {resolvedInitialName}
            </span>
          )}
        </div>
        <RunExperience
          initialName={resolvedInitialName}
          initialChatId={initialChatId}
          initialRunId={initialRunId}
          initialStatus={initialStatus}
          initialReport={initialReport}
          initialMessages={initialMessages}
          initialRemainingRuns={initialRemainingRuns}
          refresh={refresh}
          slug={slug}
        />
      </div>

      <SiteFooter navLinks={footerLinks} />
    </div>
  );
}
