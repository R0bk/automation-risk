import { useMemo } from "react";

import type { OrgReport } from "@/lib/run/report-schema";
import { buildOrgGraph, type OrgGraph } from "@/lib/run/org-graph";

export function useOrgReportGraph(report: OrgReport | null | undefined): OrgGraph | null {
  return useMemo(() => {
    if (!report) return null;
    return buildOrgGraph(report);
  }, [report]);
}

