import { z } from "zod";
import type { EnrichedOrgReport } from "./report-schema";
import { type WorkforceImpactSnapshot } from "./workforce-impact";

export type ComparativeRun = {
  runId: string;
  companyId: string;
  companySlug: string | null;
  displayName: string | null;
  hqCountry: string | null;
  industry: string | null;
  workforceMetric: WorkforceImpactSnapshot | null;
  report: EnrichedOrgReport | null;
};


export type CountryMetric = {
  country: string;
  isoCode: string | null;
  runCount: number;
  averageScore: number | null;
  averageAutomation: number | null;
  averageAugmentation: number | null;
  averageHeadcount: number | null;
};

export type IndustryMetric = {
  industry: string;
  runCount: number;
  averageScore: number | null;
  averageAutomation: number | null;
  averageAugmentation: number | null;
  averageHeadcount: number | null;
};

export type HeatmapCell = {
  country: string;
  isoCode: string | null;
  industry: string;
  runCount: number;
  averageScore: number | null;
  highRiskShare: number | null;
};

export type DistributionEntry = {
  key: string;
  label: string;
  runCount: number;
  isoCode?: string | null;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
};

export type TopTaskMetric = {
  task: string;
  automationExposure: number;
  augmentationExposure: number;
  totalExposure: number;
  automationShare: number;
  augmentationShare: number;
  runCount: number;
  sampleRoles: string[];
  topCompanies: Array<{ name: string; exposure: number; share: number }>;
};

export type ComparativeAnalyticsPayload = {
  generatedAt: string;
  coverage: {
    companies: number;
    runs: number;
    totalHeadcount: number;
    averageExposure: number;
  };
  countries: CountryMetric[];
  industries: IndustryMetric[];
  heatmap: HeatmapCell[];
  distributions: {
    byCountry: DistributionEntry[];
    byIndustry: DistributionEntry[];
  };
  topTasks: TopTaskMetric[];
};

export const comparativeAnalyticsSchema = z.object({
  generatedAt: z.string(),
  coverage: z.object({
    companies: z.number(),
    runs: z.number(),
    totalHeadcount: z.number(),
    averageExposure: z.number(),
  }),
  countries: z.array(
    z.object({
      country: z.string(),
      isoCode: z.string().nullable(),
      runCount: z.number(),
      averageScore: z.number().nullable(),
      averageAutomation: z.number().nullable(),
      averageAugmentation: z.number().nullable(),
      averageHeadcount: z.number().nullable(),
    })
  ),
  industries: z.array(
    z.object({
      industry: z.string(),
      runCount: z.number(),
      averageScore: z.number().nullable(),
      averageAutomation: z.number().nullable(),
      averageAugmentation: z.number().nullable(),
      averageHeadcount: z.number().nullable(),
    })
  ),
  heatmap: z.array(
    z.object({
      country: z.string(),
      isoCode: z.string().nullable(),
      industry: z.string(),
      runCount: z.number(),
      averageScore: z.number().nullable(),
      highRiskShare: z.number().nullable(),
    })
  ),
  distributions: z.object({
    byCountry: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        isoCode: z.string().nullable().optional(),
        runCount: z.number(),
        min: z.number().nullable(),
        q1: z.number().nullable(),
        median: z.number().nullable(),
        q3: z.number().nullable(),
        max: z.number().nullable(),
      })
    ),
    byIndustry: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        runCount: z.number(),
        min: z.number().nullable(),
        q1: z.number().nullable(),
        median: z.number().nullable(),
        q3: z.number().nullable(),
        max: z.number().nullable(),
      })
    ),
  }),
  topTasks: z.array(
    z.object({
      task: z.string(),
      automationExposure: z.number(),
      augmentationExposure: z.number(),
      totalExposure: z.number(),
      automationShare: z.number(),
      augmentationShare: z.number(),
      runCount: z.number(),
      sampleRoles: z.array(z.string()),
      topCompanies: z.array(
        z.object({
          name: z.string(),
          exposure: z.number(),
          share: z.number(),
        })
      ),
    })
  ),
});

export type ComparativeAnalytics = z.infer<typeof comparativeAnalyticsSchema>;
