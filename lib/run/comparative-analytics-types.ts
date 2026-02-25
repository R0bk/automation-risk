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
  /** Average net change in total AI exposure (auto+aug tasks) per role, v1→v4 */
  netExposureDelta?: number | null;
  /** Average change in automation tasks per role */
  automationDelta?: number | null;
  /** Average change in augmentation tasks per role */
  augmentationDelta?: number | null;
};

export type IndustryMetric = {
  industry: string;
  runCount: number;
  averageScore: number | null;
  averageAutomation: number | null;
  averageAugmentation: number | null;
  averageHeadcount: number | null;
  /** Average net change in total AI exposure (auto+aug tasks) per role, v1→v4 */
  netExposureDelta?: number | null;
  /** Average change in automation tasks per role */
  automationDelta?: number | null;
  /** Average change in augmentation tasks per role */
  augmentationDelta?: number | null;
};

export type HeatmapCell = {
  country: string;
  isoCode: string | null;
  industry: string;
  runCount: number;
  averageScore: number | null;
  highRiskShare: number | null;
  /** Average net change in total AI exposure per role, v1→v4 */
  netExposureDelta?: number | null;
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
  /** Change in automation classification for this task, v1→v4 */
  automationDelta?: number | null;
  /** Change in augmentation classification for this task, v1→v4 */
  augmentationDelta?: number | null;
};

export type CompanyMetric = {
  name: string;
  slug: string | null;
  hqCountry: string | null;
  industry: string | null;
  headcount: number;
  /** HC-weighted average net AI exposure delta (auto+aug tasks per role), v1→v4 */
  netAIDelta: number;
  /** HC-weighted average automation tasks delta per role */
  automationDelta: number;
  /** HC-weighted average augmentation tasks delta per role */
  augmentationDelta: number;
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
  companies?: CompanyMetric[];
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
      netExposureDelta: z.number().nullable().optional(),
      automationDelta: z.number().nullable().optional(),
      augmentationDelta: z.number().nullable().optional(),
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
      netExposureDelta: z.number().nullable().optional(),
      automationDelta: z.number().nullable().optional(),
      augmentationDelta: z.number().nullable().optional(),
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
      netExposureDelta: z.number().nullable().optional(),
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
      automationDelta: z.number().nullable().optional(),
      augmentationDelta: z.number().nullable().optional(),
    })
  ),
  companies: z.array(
    z.object({
      name: z.string(),
      slug: z.string().nullable(),
      hqCountry: z.string().nullable(),
      industry: z.string().nullable(),
      headcount: z.number(),
      netAIDelta: z.number(),
      automationDelta: z.number(),
      augmentationDelta: z.number(),
    })
  ).optional(),
});

export type ComparativeAnalytics = z.infer<typeof comparativeAnalyticsSchema>;
