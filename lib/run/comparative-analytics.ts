import {
  COUNTRY_GROUP_ALIASES,
  INDUSTRY_GROUP_ALIASES,
} from "@/lib/constants/aggregation-groups";
import { resolveIsoCode } from "@/lib/constants/countries";
import { buildCodeLookup, loadOnetCatalog, type CatalogTaskMetric } from "@/lib/onet/catalog";
import {
  ComparativeRun,
  ComparativeAnalyticsPayload,
  CountryMetric,
  IndustryMetric,
  HeatmapCell,
  DistributionEntry,
  TopTaskMetric,
} from "./comparative-analytics-types";

import { buildRoleHeadcountMap } from "./workforce-impact";


type GroupAccumulator = {
  key: string;
  label: string;
  isoCode?: string | null;
  scores: number[];
  automation: number[];
  augmentation: number[];
  headcounts: number[];
  runIds: Set<string>;
  weightedScoreSum: number;
  weightedAutomationSum: number;
  weightedAugmentationSum: number;
  weightSum: number;
};

function ensureGroup(
  map: Map<string, GroupAccumulator>,
  key: string,
  label: string,
  isoCode?: string | null
) {
  let match = map.get(key);
  if (!match) {
    match = {
      key,
      label,
      isoCode: isoCode ?? null,
      scores: [],
      automation: [],
      augmentation: [],
      headcounts: [],
      runIds: new Set(),
      weightedScoreSum: 0,
      weightedAutomationSum: 0,
      weightedAugmentationSum: 0,
      weightSum: 0,
    };
    map.set(key, match);
  }
  return match;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(
  weightedSum: number,
  weight: number,
  fallback: number[]
) {
  if (weight > 0) {
    return weightedSum / weight;
  }
  return average(fallback);
}

function quantiles(values: number[]) {
  if (values.length === 0) {
    return {
      min: null,
      q1: null,
      median: null,
      q3: null,
      max: null,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const qAt = (p: number) => {
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  return {
    min: sorted[0],
    q1: qAt(0.25),
    median: qAt(0.5),
    q3: qAt(0.75),
    max: sorted[sorted.length - 1],
  };
}



type TaskAccumulator = {
  task: string;
  automationExposure: number;
  augmentationExposure: number;
  runIds: Set<string>;
  roles: Set<string>;
  companies: Map<string, { name: string; exposure: number }>;
};


const HIGH_RISK_THRESHOLD = 6;
const MAX_TOP_TASKS = 10;
const MAX_SAMPLE_ROLES_PER_TASK = 5;
const MIN_TASK_EXPOSURE = 1;
const MAX_COMPANY_CONTRIBUTORS = 8;
const ONET_ROLE_LOOKUP = buildCodeLookup(loadOnetCatalog());

const normaliseShare = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const normalizeCountryLabel = (
  raw: string | null | undefined
): string | null => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return COUNTRY_GROUP_ALIASES[trimmed] ?? trimmed;
};

const normalizeIndustryLabel = (
  raw: string | null | undefined
): string | null => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return INDUSTRY_GROUP_ALIASES[trimmed] ?? trimmed;
};

export function buildComparativeAnalytics(
  runs: ComparativeRun[]
): ComparativeAnalyticsPayload {
  const countries = new Map<string, GroupAccumulator>();
  const industries = new Map<string, GroupAccumulator>();
  const heatmap = new Map<
    string,
    {
      key: string;
      country: string;
      isoCode: string | null;
      industry: string;
      scores: number[];
      highRisk: number;
      runs: Set<string>;
    }
  >();
  const taskAccumulator = new Map<string, TaskAccumulator>();

  for (const run of runs) {
    const metric = run.workforceMetric;
    if (!metric) {
      continue;
    }

    const score = metric.score;
    const automation = metric.automationComponent ?? null;
    const augmentation = metric.augmentationComponent ?? null;
    const headcount = metric.totalHeadcount ?? null;
    const weight = headcount != null && headcount > 0 ? headcount : null;

    const countryLabel = normalizeCountryLabel(run.hqCountry);
    const countryCode = resolveIsoCode(countryLabel);
    const industryLabel = normalizeIndustryLabel(run.industry);

    if (countryLabel) {
      const group = ensureGroup(
        countries,
        countryLabel.toLowerCase(),
        countryLabel,
        countryCode
      );
      group.runIds.add(run.runId);
      if (typeof score === "number" && Number.isFinite(score)) {
        group.scores.push(score);
      }
      if (typeof automation === "number" && Number.isFinite(automation)) {
        group.automation.push(automation);
      }
      if (typeof augmentation === "number" && Number.isFinite(augmentation)) {
        group.augmentation.push(augmentation);
      }
      if (headcount != null) {
        group.headcounts.push(headcount);
        if (weight != null) {
          group.weightSum += weight;
          if (typeof score === "number" && Number.isFinite(score)) {
            group.weightedScoreSum += score * weight;
          }
          if (typeof automation === "number" && Number.isFinite(automation)) {
            group.weightedAutomationSum += automation * weight;
          }
          if (typeof augmentation === "number" && Number.isFinite(augmentation)) {
            group.weightedAugmentationSum += augmentation * weight;
          }
        }
      }
    }

    if (industryLabel) {
      const group = ensureGroup(
        industries,
        industryLabel.toLowerCase(),
        industryLabel
      );
      group.runIds.add(run.runId);
      if (typeof score === "number" && Number.isFinite(score)) {
        group.scores.push(score);
      }
      if (typeof automation === "number" && Number.isFinite(automation)) {
        group.automation.push(automation);
      }
      if (typeof augmentation === "number" && Number.isFinite(augmentation)) {
        group.augmentation.push(augmentation);
      }
      if (headcount != null) {
        group.headcounts.push(headcount);
        if (weight != null) {
          group.weightSum += weight;
          if (typeof score === "number" && Number.isFinite(score)) {
            group.weightedScoreSum += score * weight;
          }
          if (typeof automation === "number" && Number.isFinite(automation)) {
            group.weightedAutomationSum += automation * weight;
          }
          if (typeof augmentation === "number" && Number.isFinite(augmentation)) {
            group.weightedAugmentationSum += augmentation * weight;
          }
        }
      }
    }

    if (countryLabel && industryLabel) {
      const key = `${countryLabel.toLowerCase()}::${industryLabel.toLowerCase()}`;
      let cell = heatmap.get(key);
      if (!cell) {
        cell = {
          key,
          country: countryLabel,
          isoCode: countryCode,
          industry: industryLabel,
          scores: [],
          highRisk: 0,
          runs: new Set(),
        };
        heatmap.set(key, cell);
      }
      cell.runs.add(run.runId);
      cell.scores.push(score);
      if (score >= HIGH_RISK_THRESHOLD) {
        cell.highRisk += 1;
      }
    }

    if (run.report) {
      const roleHeadcounts = buildRoleHeadcountMap(run.report);
      if (roleHeadcounts.size > 0) {
        for (const role of run.report.roles ?? []) {
          const code = role.onetCode.trim();
          if (!code) continue;
          const normalizedCode = code.toLowerCase();
          const roleHeadcount = roleHeadcounts.get(normalizedCode);
          if (!roleHeadcount || roleHeadcount <= 0) continue;

          const roleAutomationShare = (() => {
            const direct = normaliseShare(role.automationShare);
            if (direct > 0) return direct;
            return normaliseShare(role.taskMixShares?.automation ?? null);
          })();

          const roleAugmentationShare = (() => {
            const direct = normaliseShare(role.augmentationShare);
            if (direct > 0) return direct;
            return normaliseShare(role.taskMixShares?.augmentation ?? null);
          })();
          const roleImpactShare = roleAutomationShare + roleAugmentationShare;
          if (roleImpactShare <= 0) continue;

          const catalogRole = ONET_ROLE_LOOKUP.get(code);
          if (!catalogRole) continue;
          const catalogTasks: CatalogTaskMetric[] = catalogRole.metrics.tasks ?? [];
          if (catalogTasks.length === 0) continue;

          const positiveWeightSum = catalogTasks.reduce((sum, task) => {
            const weight = task.normalizedWeight;
            return weight > 0 ? sum + weight : sum;
          }, 0);
          if (positiveWeightSum <= 0) continue;

          const roleName = role.title?.trim() || catalogRole.title || code;

          for (const task of catalogTasks) {
            if (!task.normalizedWeight || task.normalizedWeight <= 0) continue;

            const weight = task.normalizedWeight / positiveWeightSum;
            if (weight <= 0) continue;

            const baseExposure = roleHeadcount * weight;
            if (!Number.isFinite(baseExposure) || baseExposure <= 0) continue;

            const automationExposure = baseExposure * roleAutomationShare;
            const augmentationExposure = baseExposure * roleAugmentationShare;
            const totalExposure = automationExposure + augmentationExposure;
            if (totalExposure <= 0) continue;

            const taskKey = task.name.trim().toLowerCase();
            if (!taskKey) continue;

            let accumulator = taskAccumulator.get(taskKey);
            if (!accumulator) {
              accumulator = {
                task: task.name,
                automationExposure: 0,
                augmentationExposure: 0,
                runIds: new Set<string>(),
                roles: new Set<string>(),
                companies: new Map<string, { name: string; exposure: number }>(),
              };
              taskAccumulator.set(taskKey, accumulator);
            }

            accumulator.automationExposure += automationExposure;
            accumulator.augmentationExposure += augmentationExposure;
            accumulator.runIds.add(run.runId);
            if (accumulator.roles.size < MAX_SAMPLE_ROLES_PER_TASK) {
              accumulator.roles.add(roleName);
            }

            const companyKey = run.companyId ?? run.runId;
            const companyLabel = run.displayName?.trim() || run.companySlug || companyKey;
            if (companyKey && companyLabel) {
              const existing = accumulator.companies.get(companyKey);
              if (existing) {
                existing.exposure += totalExposure;
              } else {
                accumulator.companies.set(companyKey, { name: companyLabel, exposure: totalExposure });
              }
            }
          }
        }
      }
    }
  }

  const sortByRunCountThenScore = <
    T extends { runCount: number; averageScore: number | null },
  >(
    list: T[]
  ) =>
    list.sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });

  const countryMetrics: CountryMetric[] = sortByRunCountThenScore(
    Array.from(countries.values()).map((group) => ({
      country: group.label,
      isoCode: group.isoCode ?? null,
      runCount: group.runIds.size,
      averageScore: weightedAverage(
        group.weightedScoreSum,
        group.weightSum,
        group.scores
      ),
      averageAutomation: weightedAverage(
        group.weightedAutomationSum,
        group.weightSum,
        group.automation
      ),
      averageAugmentation: weightedAverage(
        group.weightedAugmentationSum,
        group.weightSum,
        group.augmentation
      ),
      averageHeadcount: average(group.headcounts),
    }))
  );

  const industryMetrics: IndustryMetric[] = sortByRunCountThenScore(
    Array.from(industries.values()).map((group) => ({
      industry: group.label,
      runCount: group.runIds.size,
      averageScore: weightedAverage(
        group.weightedScoreSum,
        group.weightSum,
        group.scores
      ),
      averageAutomation: weightedAverage(
        group.weightedAutomationSum,
        group.weightSum,
        group.automation
      ),
      averageAugmentation: weightedAverage(
        group.weightedAugmentationSum,
        group.weightSum,
        group.augmentation
      ),
      averageHeadcount: average(group.headcounts),
    }))
  );

  const heatmapCells: HeatmapCell[] = Array.from(heatmap.values())
    .map((cell) => ({
      country: cell.country,
      isoCode: cell.isoCode ?? null,
      industry: cell.industry,
      runCount: cell.runs.size,
      averageScore: average(cell.scores),
      highRiskShare:
        cell.scores.length > 0 ? cell.highRisk / cell.scores.length : null,
    }))
    .sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });

  const countryDistributions: DistributionEntry[] = countryMetrics.map(
    (metric) => {
      const group = countries.get(metric.country.toLowerCase());
      if (!group) {
        return {
          key: metric.country.toLowerCase(),
          label: metric.country,
          isoCode: metric.isoCode ?? null,
          runCount: metric.runCount,
          min: null,
          q1: null,
          median: null,
          q3: null,
          max: null,
        };
      }
      const q = quantiles(group.scores);
      return {
        key: metric.country.toLowerCase(),
        label: metric.country,
        isoCode: metric.isoCode ?? null,
        runCount: metric.runCount,
        min: q.min,
        q1: q.q1,
        median: q.median,
        q3: q.q3,
        max: q.max,
      };
    }
  );

  const industryDistributions: DistributionEntry[] = industryMetrics.map(
    (metric) => {
      const group = industries.get(metric.industry.toLowerCase());
      if (!group) {
        return {
          key: metric.industry.toLowerCase(),
          label: metric.industry,
          runCount: metric.runCount,
          min: null,
          q1: null,
          median: null,
          q3: null,
          max: null,
        };
      }
      const q = quantiles(group.scores);
      return {
        key: metric.industry.toLowerCase(),
        label: metric.industry,
        runCount: metric.runCount,
        min: q.min,
        q1: q.q1,
        median: q.median,
        q3: q.q3,
        max: q.max,
      };
    }
  );

  const topTasks: TopTaskMetric[] = Array.from(taskAccumulator.values())
    .map((entry) => {
      const automationExposure = entry.automationExposure;
      const augmentationExposure = entry.augmentationExposure;
      const totalExposure = automationExposure + augmentationExposure;
      if (totalExposure <= MIN_TASK_EXPOSURE) {
        return null;
      }
      const automationShare = automationExposure / totalExposure;
      const augmentationShare = augmentationExposure / totalExposure;
      const topCompanies = Array.from(entry.companies.values())
        .sort((a, b) => b.exposure - a.exposure)
        .slice(0, MAX_COMPANY_CONTRIBUTORS)
        .map(({ name, exposure }) => ({
          name,
          exposure,
          share: exposure > 0 ? exposure / totalExposure : 0,
        }));
      return {
        task: entry.task,
        automationExposure,
        augmentationExposure,
        totalExposure,
        automationShare,
        augmentationShare,
        runCount: entry.runIds.size,
        sampleRoles: Array.from(entry.roles),
        topCompanies,
      };
    })
    .filter((entry): entry is TopTaskMetric => entry != null)
    .sort((a, b) => {
      if (b.totalExposure !== a.totalExposure) {
        return b.totalExposure - a.totalExposure;
      }
      return b.runCount - a.runCount;
    })
    .slice(0, MAX_TOP_TASKS);

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      companies: new Set(runs.map((run) => run.companyId)).size,
      runs: runs.length,
    },
    countries: countryMetrics,
    industries: industryMetrics,
    heatmap: heatmapCells,
    distributions: {
      byCountry: countryDistributions,
      byIndustry: industryDistributions,
    },
    topTasks,
  };
}

