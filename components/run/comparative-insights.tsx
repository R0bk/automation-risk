"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { ComparativeAnalytics, TopTaskMetric, CountryMetric } from "@/lib/run/comparative-analytics-types";
import { resolveIsoCode } from "@/lib/constants/countries";
import { ComposableMap, Geographies, Geography, Graticule } from "react-simple-maps";

const WORLD_GEO_URL = "/features.json";

type ComparativeInsightsProps = {
  analytics: ComparativeAnalytics | null;
  updatedAt: string | null;
};

const clampScore = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(10, Math.max(0, value));
};

const barFillColor = (value: number | null | undefined) => {
  const normalized = clampScore(value) / 10;
  const lightness = 92 - normalized * 48; // 92% (soft peach) down to ~44% (deep orange)
  return `hsl(22deg 88% ${lightness}%)`;
};

const AUTOMATION_BAR_COLOR = "hsl(22deg 92% 48%)";
const AUGMENTATION_BAR_COLOR = "hsl(22deg 96% 66%)";
const MIN_TRACK_PERCENT = 12;


const computeStackedBarSegments = (
  score: number | null | undefined,
  automation: number | null | undefined,
  augmentation: number | null | undefined
) => {
  const totalScore = clampScore(score);
  if (totalScore <= 0) {
    return {
      trackPercent: 0,
      automationPercent: 0,
      augmentationPercent: 0,
      residualPercent: 0,
      hasAutomation: false,
      hasAugmentation: false,
      hasResidual: false,
      totalScore,
    };
  }

  const automationScore = Math.min(
    totalScore,
    clampScore((automation ?? 0) * 10)
  );
  const augmentationScore = Math.min(
    Math.max(totalScore - automationScore, 0),
    clampScore((augmentation ?? 0) * 10)
  );
  const residualScore = Math.max(
    0,
    totalScore - automationScore - augmentationScore
  );

  const scorePercent = Math.max((totalScore / 10) * 100, MIN_TRACK_PERCENT);
  const automationPercent =
    totalScore > 0 ? (automationScore / totalScore) * 100 : 0;
  const augmentationPercent =
    totalScore > 0 ? (augmentationScore / totalScore) * 100 : 0;
  const residualPercent =
    totalScore > 0
      ? Math.max(0, 100 - automationPercent - augmentationPercent)
      : 0;

  return {
    trackPercent: scorePercent,
    automationPercent,
    augmentationPercent,
    residualPercent,
    hasAutomation: automationScore > 0.001,
    hasAugmentation: augmentationScore > 0.001,
    hasResidual: residualScore > 0.001,
    totalScore,
  };
};

type ScoreBarProps = {
  score: number | null | undefined;
  automation: number | null | undefined;
  augmentation: number | null | undefined;
  className?: string;
};

function ScoreBar({
  score,
  automation,
  augmentation,
  className,
}: ScoreBarProps) {
  const segments = computeStackedBarSegments(score, automation, augmentation);

  if (segments.trackPercent <= 0) {
    return (
      <div
        className={`h-2.5 overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]${
          className ? ` ${className}` : ""
        }`}
      />
    );
  }

  const baseColor = barFillColor(segments.totalScore);

  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-[rgba(38,37,30,0.08)]${
        className ? ` ${className}` : ""
      }`}
    >
      <div
        className="flex h-full overflow-hidden rounded-full shadow-[0_4px_14px_rgba(245,78,0,0.25)]"
        style={{ width: `${Math.min(segments.trackPercent, 100)}%` }}
      >
        {segments.hasAutomation && (
          <div
            className="flex-none"
            style={{
              width: `${segments.automationPercent}%`,
              backgroundColor: AUTOMATION_BAR_COLOR,
              minWidth: "4px",
            }}
          />
        )}
        {segments.hasAugmentation && (
          <div
            className="flex-none"
            style={{
              width: `${segments.augmentationPercent}%`,
              backgroundColor: AUGMENTATION_BAR_COLOR,
              minWidth: "4px",
            }}
          />
        )}
        {segments.hasResidual && (
          <div
            className="flex-1"
            style={{
              width: `${segments.residualPercent}%`,
              backgroundColor: baseColor,
            }}
          />
        )}
      </div>
    </div>
  );
}

type TaskExposureBarProps = {
  entry: TopTaskMetric;
  className?: string;
};

function TaskExposureBar({ entry, className }: TaskExposureBarProps) {
  const { totalExposure, automationExposure, augmentationExposure } = entry;
  if (!totalExposure || totalExposure <= 0) {
    return <div className={className} />;
  }

  const automationLabel =
    automationExposure > 0 ? `${formatMillions(automationExposure)}M` : null;
  const augmentationLabel =
    augmentationExposure > 0 ? `${formatMillions(augmentationExposure)}M` : null;

  return (
    <div
      className={`flex min-w-[100px] lg:min-w-[220px] items-center justify-end gap-2 ${className ?? ""}`}
    >
      {automationLabel && (
        <span className="text-[rgba(245,78,0,0.92)] text-[11px] font-bold">
          {automationLabel}
        </span>
      )}
      {augmentationLabel && (
        <span className="text-[rgba(255,148,77,0.9)] text-[11px] font-bold">
          {augmentationLabel}
        </span>
      )}
    </div>
  );
}

const formatExposurePercent = (
  value: number | null | undefined,
  fractionDigits = 0
) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const clamped = clampScore(value) * 10;
  return `${clamped.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
};

const peopleFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatMillions = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }
  const millions = value / 1_000_000;
  return (Math.round(millions * 10) / 10).toFixed(1);
};

type WorldExposureMapProps = {
  countries: CountryMetric[];
  variant?: "card" | "embedded";
};

function WorldExposureMap({ countries, variant = "card" }: WorldExposureMapProps) {
  // Countries data available for debugging

  const normalizeIso = (geo: any): string => {
    const iso2Candidate = (geo.properties?.ISO_A2_EH ?? geo.properties?.ISO_A2 ?? null) as string | null;
    const iso2 = iso2Candidate ? iso2Candidate.toUpperCase() : null;
    if (iso2 && iso2 !== "-99") {
      return iso2;
    }
    const byName = resolveIsoCode((geo.properties?.name as string | null) ?? null);
    if (byName) {
      return byName.toUpperCase();
    }
    const iso3Candidate = (geo.properties?.ISO_A3 ?? null) as string | null;
    if (iso3Candidate && iso3Candidate !== "-99") {
      const iso3 = iso3Candidate.toUpperCase();
      if (iso3.length === 3) {
        const alias = resolveIsoCode(geo.properties?.ADMIN ?? geo.properties?.NAME ?? null);
        if (alias) {
          return alias.toUpperCase();
        }
      }
    }
    // Missing ISO code for country
    return "";
  };

  const countryLookup = useMemo(() => {
    const map = new Map<string, CountryMetric>();
    for (const country of countries) {
      const rawIso = country.isoCode?.toUpperCase();
      const derivedIso = resolveIsoCode(country.country)?.toUpperCase() ?? null;
      const iso = rawIso && rawIso !== "-99" ? rawIso : derivedIso;
      if (!iso || iso === "-99") continue;
      const existing = map.get(iso);
      if (!existing || (existing.runCount ?? 0) < (country.runCount ?? 0)) {
        map.set(iso, country);
      }
    }
    return map;
  }, [countries]);

  if (countryLookup.size === 0) {
    return null;
  }

  // Sample country metrics available

  const scores = Array.from(countryLookup.values())
    .map((metric) => clampScore(metric.averageScore))
    .filter((value) => value > 0);
  const minScore = scores.length > 0 ? Math.min(...scores) : null;
  const maxScore = scores.length > 0 ? Math.max(...scores) : null;

  const getFill = (iso: string) => {
    const metric = countryLookup.get(iso);
    if (!metric) {
      return "rgba(38,37,30,0.08)";
    }
    const score = clampScore(metric.averageScore);
    if (minScore == null || maxScore == null || maxScore <= minScore) {
      return "hsl(22deg 78% 64%)";
    }
    const normalized = Math.min(1, Math.max(0, (score - minScore) / (maxScore - minScore)));
    // Color scale debugging available
    const saturation = 70 + normalized * 25; // 70% -> 95%
    const lightness = 80 - normalized * 38; // 80% -> 42%
    return `hsl(22deg ${saturation}% ${lightness}%)`;
  };

  const getHoverFill = (iso: string) => {
    const base = getFill(iso);
    return base.replace(/(\d+\.\d+|\d+)%\)$/g, (match) => {
      const value = parseFloat(match.replace("%", ""));
      const adjusted = Math.max(35, value - 8);
      return `${adjusted}%)`;
    });
  };

  const getTooltip = (iso: string) => {
    const metric = countryLookup.get(iso);
    if (!metric) {
      return null;
    }
    const score = clampScore(metric.averageScore);
    return `${metric.country} · ${metric.runCount} runs · Avg score ${score.toFixed(1)}`;
  };

  const mapElement = (
    <ComposableMap projectionConfig={{ scale: 170, center: [20, 0] }} width={720}  className="h-full w-full">
      {/* <Sphere id="sphere" stroke="rgba(38,37,30,0.2)" strokeWidth={0.6} fill="none" /> */}
      <Graticule stroke="rgba(38,37,30,0.12)" strokeWidth={0.35} />
      <Geographies geography={WORLD_GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const iso = normalizeIso(geo);
            const metric = iso ? countryLookup.get(iso) : null;
            const tooltip = metric ? getTooltip(iso) : null;
            const fill = metric ? getFill(iso) : "rgba(38,37,30,0.08)";
            const hoverFill = metric ? getHoverFill(iso) : fill;
            const strokeColor = "rgba(255,255,255,0.55)";
            // Geography debugging available
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={0.45}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: hoverFill },
                  pressed: { outline: "none", fill: hoverFill },
                }}
              >
                {tooltip ? <title>{tooltip}</title> : null}
              </Geography>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );

  if (variant === "embedded") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.08)] bg-[rgba(38,37,30,0.02)]">
        {mapElement}
      </div>
    );
  }

  return (
    <section
      aria-label="Global coverage map"
      className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.68)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[11px] uppercase tracking-[0.28em] text-[rgba(38,37,30,0.6)]">
          Global coverage
        </h3>
        <span className="text-[rgba(38,37,30,0.45)] text-xs">
          Fill = average score · tooltip = detail
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.08)] bg-[rgba(38,37,30,0.02)]">
        {mapElement}
      </div>
    </section>
  );
}

const computeHeatmapStyle = (
  score: number | null,
  minScore: number | null,
  maxScore: number | null
) => {
  if (score == null || minScore == null || maxScore == null) {
    return {
      backgroundColor: "rgba(38,37,30,0.08)",
      color: "rgba(38,37,30,0.75)",
    };
  }
  const range = maxScore - minScore;
  const normalized = range > 0 ? (score - minScore) / range : 0.5;
  const clamped = Math.min(1, Math.max(0, normalized));
  const lightness = 94 - clamped * 54; // 94% down to 40%
  const backgroundColor = `hsl(22deg 90% ${lightness}%)`;
  const textColor =
    lightness < 58 ? "rgba(255,255,255,0.92)" : "rgba(38,37,30,0.85)";
  return { backgroundColor, color: textColor };
};

const sortByImpact = <
  T extends { averageScore: number | null; runCount: number },
>(
  entries: T[]
) =>
  entries.slice().sort((a, b) => {
    const scoreDiff = clampScore(b.averageScore) - clampScore(a.averageScore);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }
    return b.runCount - a.runCount;
  });

export function ComparativeInsights({ analytics }: ComparativeInsightsProps) {
  const { open: openOnboarding } = useOnboarding();
  const hasData = Boolean(analytics && analytics.countries.length > 0);

  const topTasks = (analytics?.topTasks ?? []) as TopTaskMetric[];
  const hasTopTasks = topTasks.length > 0;
  const [countryView, setCountryView] = useState<"list" | "world">("list");

  const sortedCountries = sortByImpact(analytics?.countries ?? []);
  const sortedIndustries = sortByImpact(analytics?.industries ?? []);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showFullHeatmap, setShowFullHeatmap] = useState(false);
  useEffect(() => {
    setShowAllIndustries(false);
    setShowAllCountries(false);
    setShowFullHeatmap(false);
    setCountryView("list");
  }, [analytics]);

  const INDUSTRY_PREVIEW_COUNT = 5;
  const COUNTRY_PREVIEW_COUNT = 5;

  const industryPreviewTop = sortedIndustries.slice(0, INDUSTRY_PREVIEW_COUNT);
  const industryPreviewBottomRaw = sortedIndustries.slice(-INDUSTRY_PREVIEW_COUNT);
  const countryPreviewTop = sortedCountries.slice(0, COUNTRY_PREVIEW_COUNT);
  const countryPreviewBottomRaw = sortedCountries.slice(-COUNTRY_PREVIEW_COUNT);

  const industryHasToggle = sortedIndustries.length > INDUSTRY_PREVIEW_COUNT * 2;
  const countryHasToggle = sortedCountries.length > COUNTRY_PREVIEW_COUNT * 2;

  const industryCollapsedBottom = industryHasToggle
    ? industryPreviewBottomRaw.filter(
        (entry) => !industryPreviewTop.some((top) => top.industry === entry.industry)
      )
    : [];
  const countryCollapsedBottom = countryHasToggle
    ? countryPreviewBottomRaw.filter(
        (entry) => !countryPreviewTop.some((top) => top.country === entry.country)
      )
    : [];

  const toggleButtonClass =
    "inline-flex items-center gap-2 rounded-full border border-[rgba(38,37,30,0.18)] bg-white/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-[rgba(38,37,30,0.6)] transition-shadow duration-200 hover:shadow-[0_12px_26px_rgba(34,28,20,0.16)] focus:outline-none focus:ring-2 focus:ring-[#f54e00]/35 focus:ring-offset-1";

  const renderIndustryRow = (entry: (typeof sortedIndustries)[number]) => (
    <li
      key={entry.industry}
      className="flex items-center gap-3 text-[rgba(38,37,30,0.7)]"
    >
      <div className="flex min-w-[220px] items-center gap-1.5">
        <span className="font-medium leading-tight">
          {entry.industry}
        </span>
        <span className="text-[9px] text-[rgba(38,37,30,0.5)] uppercase tracking-[0.1em]">
          {entry.runCount} runs
        </span>
      </div>
      <ScoreBar
        automation={entry.averageAutomation}
        augmentation={entry.averageAugmentation}
        score={entry.averageScore}
        className="flex-1"
      />
      <span className="font-mono text-[rgba(38,37,30,0.6)]">
        {formatExposurePercent(entry.averageScore)}
      </span>
    </li>
  );

  const renderCountryRow = (entry: (typeof sortedCountries)[number]) => (
    <li
      key={entry.country}
      className="flex items-center gap-3 text-[rgba(38,37,30,0.7)]"
    >
      <div className="flex min-w-[220px] items-center gap-1.5">
        <span className="font-medium leading-tight">
          {entry.country}
        </span>
        <span className="text-[9px] text-[rgba(38,37,30,0.5)] uppercase tracking-[0.1em]">
          {entry.runCount} runs
        </span>
      </div>
      <ScoreBar
        automation={entry.averageAutomation}
        augmentation={entry.averageAugmentation}
        score={entry.averageScore}
        className="flex-1"
      />
      <span className="font-mono text-[rgba(38,37,30,0.6)]">
        {formatExposurePercent(entry.averageScore)}
      </span>
    </li>
  );

  const sortedCountriesByRuns = (analytics?.countries ?? [])
    .slice()
    .sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return clampScore(b.averageScore) - clampScore(a.averageScore);
    });
  const sortedIndustriesByRuns = (analytics?.industries ?? [])
    .slice()
    .sort((a, b) => {
      if (b.runCount !== a.runCount) {
        return b.runCount - a.runCount;
      }
      return clampScore(b.averageScore) - clampScore(a.averageScore);
    });

  const heatmapCountriesAll = sortedCountriesByRuns
    .slice(0, 60)
    .map((entry) => entry.country);
  const heatmapIndustriesAll = sortedIndustriesByRuns
    .slice(0, 60)
    .map((entry) => entry.industry);

  const heatmapLookup = new Map<
    string,
    { score: number | null; runs: number; highRiskShare: number | null }
  >();
  const heatmapScores: number[] = [];

  for (const cell of analytics?.heatmap ?? []) {
    if (
      !heatmapCountriesAll.includes(cell.country) ||
      !heatmapIndustriesAll.includes(cell.industry)
    ) {
      continue;
    }
    const score = cell.averageScore ?? null;
    if (score != null) {
      heatmapScores.push(score);
    }
    heatmapLookup.set(`${cell.country}__${cell.industry}`, {
      score,
      runs: cell.runCount,
      highRiskShare: cell.highRiskShare,
    });
  }

  const heatmapMin =
    heatmapScores.length > 0 ? Math.min(...heatmapScores) : null;
  const heatmapMax =
    heatmapScores.length > 0 ? Math.max(...heatmapScores) : null;
  const HEATMAP_PREVIEW_LIMIT = 7;
  const heatmapCountries =
    showFullHeatmap || heatmapCountriesAll.length <= HEATMAP_PREVIEW_LIMIT
      ? heatmapCountriesAll
      : heatmapCountriesAll.slice(0, HEATMAP_PREVIEW_LIMIT);
  const heatmapIndustries =
    showFullHeatmap || heatmapIndustriesAll.length <= HEATMAP_PREVIEW_LIMIT
      ? heatmapIndustriesAll
      : heatmapIndustriesAll.slice(0, HEATMAP_PREVIEW_LIMIT);
  const heatmapHasToggle =
    heatmapCountriesAll.length > HEATMAP_PREVIEW_LIMIT ||
    heatmapIndustriesAll.length > HEATMAP_PREVIEW_LIMIT;

  const distributionsByIndustry =
    analytics?.distributions.byIndustry.slice(0, 6) ?? [];
  const distributionsByCountry =
    analytics?.distributions.byCountry.slice(0, 6) ?? [];
  const showDistributionSnapshots = false;
  const companiesAnalysedCount = analytics?.coverage.companies ?? null;
  const companiesAnalysedLabel = companiesAnalysedCount
    ? `${companiesAnalysedCount.toLocaleString()} companies`
    : "companies";

  return (
    <>
      <section
        aria-labelledby="comparative-insights-heading"
        className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] p-1 pt-6 lg:p-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] "
      >
        <div className="-z-10 pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.08),_rgba(245,78,0,0)_60%)] lg:bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.16),_rgba(245,78,0,0)_60%)]" />
        <header className="flex flex-wrap justify-end items-start lg:justify-between gap-0 lg:gap-6 px-5 lg:px-0">
          <div>
            <p className="max-w-5xl text-[rgba(38,37,30,0.78)] text-lg leading-relaxed">
              <span className="text-xl font-medium">Where is AI exposure the highest?</span>{" "}
              <br />
              Values show the % share of roles already seeing{" "}
              <span
                className="font-semibold"
                style={{ color: "hsl(22deg 96% 66%)" }}
              >
                AI Augmentation
              </span>{" "}
              or{" "}
              <span
                className="font-semibold"
                style={{ color: "hsl(22deg 92% 48%)" }}
              >
                AI Automation
              </span>
              .
            </p>
          </div>
          {analytics && (
            <div className="flex flex-col items-end gap-1 text-right text-[rgba(38,37,30,0.55)] text-xs">
              <span>{analytics.coverage.companies.toLocaleString()} companies, {(analytics.coverage.totalHeadcount / 1000000).toFixed(1)}M employees</span>
              {analytics.coverage.averageExposure > 0 && (
                <span>{(analytics.coverage.averageExposure * 10).toFixed(1)}% avg AI exposure</span>
              )}
            </div>
          )}
        </header>

      {hasData ? (
        <div className="mt-4 space-y-10">
          <section
            aria-label="Country overview"
            className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
          >
            <div className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.68)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-[11px] text-[rgba(38,37,30,0.6)] uppercase tracking-[0.28em]">
                  By Industry
                </h3>
                <span className="text-[rgba(38,37,30,0.45)] text-xs">
                  Avg share of roles (%)
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {(showAllIndustries || !industryHasToggle
                  ? sortedIndustries
                  : industryPreviewTop
                ).map(renderIndustryRow)}
                {!showAllIndustries && industryHasToggle && (
                  <li key="industry-expand" className="flex justify-center py-2">
                    <button
                      type="button"
                      onClick={() => setShowAllIndustries(true)}
                      aria-expanded={showAllIndustries}
                      className={toggleButtonClass}
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Show all {sortedIndustries.length}
                    </button>
                  </li>
                )}
                {!showAllIndustries &&
                  industryHasToggle &&
                  industryCollapsedBottom.map(renderIndustryRow)}
                {showAllIndustries && industryHasToggle && (
                  <li key="industry-collapse" className="flex justify-center py-2">
                    <button
                      type="button"
                      onClick={() => setShowAllIndustries(false)}
                      aria-expanded={showAllIndustries}
                      className={toggleButtonClass}
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Collapse list
                    </button>
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.68)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-[11px] text-[rgba(38,37,30,0.6)] uppercase tracking-[0.28em]">
                  By Country
                </h3>
                <div className="inline-flex items-center -mt-1 gap-1 rounded-full border border-[rgba(38,37,30,0.16)] bg-white/70 p-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(38,37,30,0.55)]">
                  <button
                    type="button"
                    onClick={() => setCountryView("list")}
                    className={`rounded-full px-2 py-0.5 transition-colors duration-150 ${
                      countryView === "list"
                        ? "bg-[rgba(38,37,30,0.55)] text-white shadow-[0_6px_16px_rgba(38,37,30,0.22)]"
                        : "text-[rgba(38,37,30,0.6)] hover:text-[rgba(38,37,30,0.8)]"
                    }`}
                    aria-pressed={countryView === "list"}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryView("world")}
                    className={`rounded-full px-2 py-0.5 transition-colors duration-150 ${
                      countryView === "world"
                        ? "bg-[rgba(38,37,30,0.55)] text-white shadow-[0_6px_16px_rgba(38,37,30,0.22)]"
                        : "text-[rgba(38,37,30,0.6)] hover:text-[rgba(38,37,30,0.8)]"
                    }`}
                    aria-pressed={countryView === "world"}
                  >
                    World
                  </button>
                </div>
              </div>
              {countryView === "list" ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {(showAllCountries || !countryHasToggle
                    ? sortedCountries
                    : countryPreviewTop
                  ).map(renderCountryRow)}
                  {!showAllCountries && countryHasToggle && (
                    <li key="country-expand" className="flex justify-center py-2">
                      <button
                        type="button"
                        onClick={() => setShowAllCountries(true)}
                        aria-expanded={showAllCountries}
                        className={toggleButtonClass}
                      >
                        <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Show all {sortedCountries.length}
                      </button>
                    </li>
                  )}
                  {!showAllCountries &&
                    countryHasToggle &&
                    countryCollapsedBottom.map(renderCountryRow)}
                  {showAllCountries && countryHasToggle && (
                    <li key="country-collapse" className="flex justify-center py-2">
                      <button
                        type="button"
                        onClick={() => setShowAllCountries(false)}
                        aria-expanded={showAllCountries}
                        className={toggleButtonClass}
                      >
                        <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Collapse list
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <div className="mt-4">
                  <WorldExposureMap countries={sortedCountriesByRuns} variant="embedded" />
                </div>
              )}
            </div>
          </section>

          <section
            aria-label="Country by industry heatmap"
            className="rounded-2xl border overflow-hidden border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] p-0 shadow-[0_20px_40px_rgba(34,28,20,0.12)]"
          >
            {/* <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[11px] text-[rgba(38,37,30,0.6)] uppercase tracking-[0.28em]">
                Country × industry coverage
              </h3>
              <span className="text-[rgba(38,37,30,0.45)] text-xs">
                Cell color = share of roles impacted · tooltip = details
              </span>
            </div> */}
            <div className="overflow-x-scroll">
              <table className="min-w-full table-fixed border-separate border-spacing-0 text-[rgba(38,37,30,0.7)] text-xs">
                <thead>
                  <tr>
                    <th className="w-32 rounded-tl-xl bg-[rgba(38,37,30,0.06)] px-3 py-3 text-left font-medium text-[rgba(38,37,30,0.6)]">
                      Country
                    </th>
                    {heatmapIndustries.map((industry, index) => (
                      <th
                        className={`bg-[rgba(38,37,30,0.06)] px-3 py-3 text-left font-medium text-[rgba(38,37,30,0.6)] ${
                          index === heatmapIndustries.length - 1
                            ? "rounded-tr-xl"
                            : ""
                        }`}
                        key={industry}
                      >
                        {industry}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapCountries.map((country, rowIndex) => (
                    <tr key={country}>
                      <th className="sticky left-0 bg-[rgba(255,255,255,0.9)] px-3 py-3 text-left font-medium text-[rgba(38,37,30,0.68)]">
                        {country}
                      </th>
                      {heatmapIndustries.map((industry, colIndex) => {
                        const cell = heatmapLookup.get(
                          `${country}__${industry}`
                        );
                        const score = cell?.score ?? null;
                        const heatmapStyle = computeHeatmapStyle(
                          score,
                          heatmapMin,
                          10
                          // heatmapMax
                        );
                        const isBottom =
                          rowIndex === heatmapCountries.length - 1;
                        const isLast =
                          colIndex === heatmapIndustries.length - 1;
                        const cornerClasses: string[] = [];
                        if (isBottom && colIndex === 0) {
                          cornerClasses.push("rounded-bl-xl");
                        }
                        if (isBottom && isLast) {
                          cornerClasses.push("rounded-br-xl");
                        }
                        return (
                          <td
                            className={`px-3 py-3 text-right align-middle font-mono text-[11px] transition-colors duration-150 ${cornerClasses.join(" ")}`}
                            key={industry}
                            style={heatmapStyle}
                            title={
                              cell
                                ? `${country} • ${industry}\nShare of roles impacted ${formatExposurePercent(cell.score, 1)} · ${
                                    cell.runs
                                  } runs · High risk ${formatPercent(cell.highRiskShare)}`
                                : `${country} • ${industry}\nNo completed runs yet`
                            }
                          >
                            {cell ? formatExposurePercent(cell.score, 0) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showFullHeatmap && heatmapHasToggle && (
              <div className="-mt-9 mb-1.5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowFullHeatmap(true)}
                  aria-expanded={showFullHeatmap}
                  className={toggleButtonClass}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Show full heatmap
                </button>
              </div>
            )}
            {showFullHeatmap && heatmapHasToggle && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowFullHeatmap(false)}
                  aria-expanded={showFullHeatmap}
                  className={toggleButtonClass}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Collapse heatmap
                </button>
              </div>
            )}
          </section>

          {hasTopTasks && (
            <TooltipProvider>
              <div className="mb-4">
                <p className="max-w-6xl px-4 lg:px-0 text-base leading-relaxed text-[rgba(38,37,30,0.78)]">
                  Within the{" "}
                  <span className="font-semibold text-[rgba(38,37,30,0.88)]">
                    {companiesAnalysedLabel}
                  </span>{" "}
                  analysed, these{" "}
                  <button
                    type="button"
                    onClick={() => openOnboarding()}
                    className="font-semibold text-[rgba(245,78,0,0.95)] underline decoration-[rgba(245,78,0,0.5)] underline-offset-4 transition-colors hover:text-[rgba(245,78,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f54e00]/35 focus-visible:ring-offset-1"
                  >
                    tasks
                  </button>{" "}
                  represent the highest headcount exposure to AI automation and augmentation.
                </p>
              </div>
              <section
                aria-label="Tasks seeing AI exposure"
                className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]"
              >
                <ul className="space-y-5 text-sm">
                  {topTasks.slice(0, 8).map((task, index) => {
                    const rolePreview =
                      task.sampleRoles.length > 3
                        ? `${task.sampleRoles.slice(0, 3).join(", ")}…`
                        : task.sampleRoles.join(", ");
                    const rankLabel = (index + 1).toString();
                    const topCompanies = task.topCompanies ?? [];
                    const hasTopCompanies = topCompanies.length > 0;

                    const rowContent = (
                      <div className="flex w-full items-start gap-3">
                        <span className="flex-shrink-0 pt-1 text-right text-base font-semibold tracking-[0.18em] text-[rgba(38,37,30,0.45)]">
                          {rankLabel}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <span className="truncate text-[10px] text-[rgba(38,37,30,0.48)]">
                              {rolePreview || "—"}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[10px] text-[rgba(38,37,30,0.55)]">
                              {Number.isFinite(task.totalExposure)
                                ? `${peopleFormatter.format(Math.round(task.totalExposure))} headcount`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-xs text-[rgba(38,37,30,0.68)]">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-sm text-[#26251e]" title={task.task}>
                                {task.task}
                              </span>
                            </div>
                            <TaskExposureBar entry={task} className="flex justify-end" />
                          </div>
                        </div>
                      </div>
                    );

                    if (!hasTopCompanies) {
                      return (
                        <li key={task.task} className="flex">
                          {rowContent}
                        </li>
                      );
                    }

                    return (
                      <li key={task.task} className="flex">
                        <Tooltip>
                          <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            <div className="min-w-[220px] space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(38,37,30,0.55)]">
                                <span>Top contributors</span>
                                <span>{task.runCount} runs</span>
                              </div>
                              <ul className="space-y-1 text-xs text-[rgba(38,37,30,0.75)]">
                                {topCompanies.map((company) => (
                                  <li key={`${task.task}-${company.name}`} className="flex items-center justify-between gap-2">
                                    <span className="truncate font-medium text-[#26251e]">{company.name}</span>
                                    <span className="font-mono text-[rgba(38,37,30,0.6)]">
                                      {Number.isFinite(company.exposure)
                                        ? `${peopleFormatter.format(Math.round(company.exposure))} · ${formatPercent(company.share)}`
                                        : "—"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </TooltipProvider>
          )}

          {showDistributionSnapshots && (
            <section
              aria-label="Distribution snapshots"
              className="grid gap-6 lg:grid-cols-2"
            >
              <div className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.68)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]">
                <h3 className="font-semibold text-[11px] text-[rgba(38,37,30,0.6)] uppercase tracking-[0.28em]">
                  Score distribution · industries
                </h3>
                <ul className="mt-4 space-y-4 text-sm">
                  {distributionsByIndustry.map((entry) => (
                    <li className="space-y-2" key={entry.key}>
                      <div className="flex items-center justify-between text-[rgba(38,37,30,0.7)]">
                        <span className="font-medium">{entry.label}</span>
                        <span className="text-[rgba(38,37,30,0.55)] text-xs">
                          {entry.runCount} runs
                        </span>
                      </div>
                      <DistributionBar entry={entry} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.68)] p-6 shadow-[0_20px_40px_rgba(34,28,20,0.12)]">
                <h3 className="font-semibold text-[11px] text-[rgba(38,37,30,0.6)] uppercase tracking-[0.28em]">
                  Score distribution · countries
                </h3>
                <ul className="mt-4 space-y-4 text-sm">
                  {distributionsByCountry.map((entry) => (
                    <li className="space-y-2" key={entry.key}>
                      <div className="flex items-center justify-between text-[rgba(38,37,30,0.7)]">
                        <span className="font-medium">{entry.label}</span>
                        <span className="text-[rgba(38,37,30,0.55)] text-xs">
                          {entry.runCount} runs
                        </span>
                      </div>
                      <DistributionBar entry={entry} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-[rgba(38,37,30,0.2)] border-dashed bg-[rgba(255,255,255,0.6)] px-6 py-10 text-center text-[rgba(38,37,30,0.6)] text-sm">
          completed runs is processed.
        </div>
      )}
      </section>
    </>
  );
}

type DistributionBarProps = {
  entry: {
    min: number | null;
    q1: number | null;
    median: number | null;
    q3: number | null;
    max: number | null;
  };
};

function DistributionBar({ entry }: DistributionBarProps) {
  const min = entry.min ?? entry.median ?? 0;
  const max = entry.max ?? entry.median ?? 0;
  const span = Math.max(0.01, max - min);

  const scale = (value: number | null | undefined) => {
    if (value == null) {
      return 0;
    }
    return ((value - min) / span) * 100;
  };

  const q1Pos = scale(entry.q1);
  const medianPos = scale(entry.median);
  const q3Pos = scale(entry.q3);
  const boxWidth = Math.max(4, Math.max(q3Pos - q1Pos, 0));

  return (
    <div className="relative h-3 rounded-full bg-[rgba(38,37,30,0.08)]">
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-[rgba(245,78,0,0.18)]"
        style={{ width: `${boxWidth}%`, marginLeft: `${q1Pos}%` }}
      />
      <div
        className="-translate-y-1/2 absolute top-1/2 h-4 w-0.5 bg-[#cf2d56]"
        style={{ left: `${medianPos}%` }}
      />
    </div>
  );
}
