"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { EnrichedOrgReport } from "@/lib/run/report-schema";

interface ReportContextValue {
  report: EnrichedOrgReport | null;
  setReportFromTool: (next: EnrichedOrgReport, sourceId?: string | null) => void;
}

const ReportContext = createContext<ReportContextValue | undefined>(undefined);

export function ReportStateProvider({
  value,
  children,
}: {
  value: ReportContextValue;
  children: ReactNode;
}) {
  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReportState() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error("useReportState must be used within a ReportStateProvider");
  }
  return context;
}
