import Link from "next/link";
import type { OrgReport } from "@/lib/run/report-schema";
import { TaskMixSelector } from "./TaskMixSelector";
import { OrgFlowChart } from "./OrgFlowChart";

interface ReportPreviewProps {
  report: OrgReport;
}

export function ReportPreview({ report }: ReportPreviewProps) {
  const topNodes = report.hierarchy
    .slice()
    .sort((a, b) => a.level - b.level)
    .slice(0, 6);

  const vulnerableRoles = report.roles
    .slice()
    .sort((a, b) => (b.automationShare ?? 0) - (a.automationShare ?? 0))
    .slice(0, 6);

  return (
    <section
      className="rounded-[32px] border border-[rgba(38,37,30,0.1)] px-6 py-7 shadow-[0_26px_65px_rgba(34,28,20,0.14)] backdrop-blur-[18px]"
      style={{
        backgroundImage: "linear-gradient(150deg, rgba(244,243,239,0.95), rgba(236,234,228,0.9))",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#26251e]">Automation share snapshot</h2>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Finalized via org_report_finalizer
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <TaskMixSelector />
          {report.metadata.sources.length > 0 && (
            <span className="text-xs text-[rgba(38,37,30,0.55)]">
              {report.metadata.sources.length} cited sources
            </span>
          )}
        </div>
      </div>

      {report.metadata.summary && (
        <p className="mt-5 text-sm leading-relaxed text-[rgba(38,37,30,0.7)]">
          {report.metadata.summary}
        </p>
      )}
      <div id="org-chart" className="-mx-6">
        <OrgFlowChart report={report} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div
          className="rounded-3xl border border-[rgba(38,37,30,0.1)] px-5 py-5 shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
          style={{
            backgroundImage: "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
          }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Org structure highlights
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-[rgba(38,37,30,0.7)]">
            {topNodes.map((node) => (
              <li
                key={node.id}
                className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] p-3"
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
                  <span>Level {node.level}</span>
                  {node.headcount != null && (
                    <span className="font-mono text-[rgba(38,37,30,0.55)]">
                      ≈ {node.headcount.toLocaleString()} staff
                    </span>
                  )}
                </div>
                <div className="mt-2 text-base font-semibold text-[#26251e]">{node.name}</div>
                <div className="mt-1 text-xs text-[rgba(38,37,30,0.55)]">
                  {node.automationShare != null && `Automation ${(node.automationShare * 100).toFixed(1)}%`}
                  {node.augmentationShare != null && ` • Augmentation ${(node.augmentationShare * 100).toFixed(1)}%`}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-3xl border border-[rgba(38,37,30,0.1)] px-5 py-5 shadow-[0_18px_40px_rgba(34,28,20,0.12)]"
          style={{
            backgroundImage: "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
          }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Highest automation share roles
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-[rgba(38,37,30,0.7)]">
            {vulnerableRoles.map((role) => (
              <li
                key={role.onetCode}
                className="flex items-center justify-between rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] px-3 py-3"
              >
                <div>
                  <div className="text-base font-semibold text-[#26251e]">{role.title}</div>
                  <div className="text-xs text-[rgba(38,37,30,0.5)]">{role.onetCode}</div>
                </div>
                <div className="font-mono text-sm text-[#cf2d56]">
                  {((role.automationShare ?? 0) * 100).toFixed(1)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs text-[rgba(38,37,30,0.55)]">
        <div className="space-x-2">
          {report.metadata.workforceEstimate != null && (
            <span>
              Workforce estimate: {report.metadata.workforceEstimate.toLocaleString()}
            </span>
          )}
          <span>
            Last updated {new Date(report.metadata.lastUpdatedIso).toLocaleString()}
          </span>
        </div>
        {/* <Link
          href="#org-chart"
          className="rounded-full border border-[rgba(38,37,30,0.12)] bg-[rgba(38,37,30,0.08)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#26251e] transition hover:bg-[rgba(38,37,30,0.12)]"
        >
          View full org chart
        </Link> */}
      </div>
    </section>
  );
}
