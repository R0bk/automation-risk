import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RunExperience } from "@/components/run/run-experience";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllCompanySlugs, getRunPageDataBySlug } from "@/lib/db/queries";
import { enrichedOrgReportSchema } from "@/lib/run/report-schema";
import { parseWorkforceMetricData } from "@/lib/run/workforce-impact";
import { convertToUIMessages } from "@/lib/utils";

type RunPageProps = { params: Promise<{ slug: string }> };

// Pre-render all existing company pages at build time
export async function generateStaticParams() {
  const slugs = await getAllCompanySlugs();
  console.log(`[ISR] Pre-rendering ${slugs.length} company pages at build time`);
  return slugs.map((slug) => ({ slug }));
}

// ISR: Revalidate every hour to keep pages fresh
export const revalidate = 3600;

// Allow new companies to be generated on-demand (not pre-rendered at build)
export const dynamicParams = true;

export default async function RunPage({ params }: RunPageProps) {
  const { slug } = await params;

  const { company, remainingRuns, latestRun, messages, metrics } = await getRunPageDataBySlug(slug);

  const parsedReport = latestRun?.finalReportJson && latestRun.status === "completed"
    ? enrichedOrgReportSchema.safeParse(latestRun.finalReportJson)
    : null;
  const initialReport = parsedReport?.success ? parsedReport.data : null;
  const initialMessages = convertToUIMessages(messages);
  const initialStatus = (latestRun?.status as "idle" | "running" | "replay" | "completed" | "failed") || "idle";
  const initialRunId = latestRun?.id || null;
  const initialChatId = latestRun?.chatId || null;

  const scoreMetric = latestRun && metrics.find((entry) => entry.metricType === "workforce_score");
  const initialWorkforceMetric = scoreMetric?.data
    ? parseWorkforceMetricData(scoreMetric.data, {
        companyName: company.displayName ?? company.slug ?? slug,
        runId: latestRun?.id,
        source: "run-page",
      })
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden" id="top" style={{ backgroundColor: "#f7f7f4" }}>
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
          <OnboardingTrigger />
        </div>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl bg-[rgba(38,37,30,0.08)]" />}>
          <RunExperience
            initialName={company?.displayName}
            initialChatId={initialChatId}
            initialRunId={initialRunId}
            initialStatus={initialStatus}
            initialReport={initialReport}
            initialMessages={initialMessages}
            initialRemainingRuns={remainingRuns}
            initialWorkforceMetric={initialWorkforceMetric}
            slug={slug}
          />
        </Suspense>
      </div>

      <SiteFooter navLinks={[
        { label: "Main site", href: "/" },
        { label: "Narrative", href: "#narrative" },
        { label: "Org chart", href: "#org-chart" },
      ]} />
    </div>
  );
}
