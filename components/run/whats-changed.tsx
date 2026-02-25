"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { TopMover, CatalogChangeSummary, CatalogTransitions } from "@/lib/onet/catalog";
import type { ComparativeAnalytics } from "@/lib/run/comparative-analytics-types";

export interface TopMoverEntry extends TopMover {}

interface WhatsChangedProps {
  movers: TopMoverEntry[];
  summary: CatalogChangeSummary;
  transitions: CatalogTransitions;
  analytics: ComparativeAnalytics | null;
}

const AUTOMATION_COLOR = "hsl(22deg 92% 48%)";
const AUGMENTATION_COLOR = "hsl(22deg 96% 66%)";
const MANUAL_COLOR = "rgba(38,37,30,0.35)";

const formatPctChange = (before: number, after: number) => {
  if (before === 0) return after > 0 ? "+100" : "0";
  const pct = Math.round(((after - before) / before) * 100);
  return pct > 0 ? `+${pct}` : `${pct}`;
};

const formatDelta = (value: number) => {
  if (value === 0) return "0";
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
};

const formatDecimal = (value: number, decimals = 3) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
};

const formatHeadcount = (hc: number) => {
  if (hc >= 1_000_000) return `${(hc / 1_000_000).toFixed(1)}M`;
  if (hc >= 1_000) return `${Math.round(hc / 1_000)}K`;
  return hc.toLocaleString();
};

// ── Section wrapper ─────────────────────────────────────────
function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-10 ${className ?? ""}`}>
      <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Sparkline (inline 2-point slope: auto & aug deltas) ─────
function Sparkline({
  automationDelta,
  augmentationDelta,
  maxAbsDelta,
}: {
  automationDelta: number;
  augmentationDelta: number;
  maxAbsDelta: number;
}) {
  const w = 52, h = 26, pad = 3;
  const halfH = h / 2 - pad;
  const scale = maxAbsDelta > 0 ? halfH / maxAbsDelta : 0;
  const mid = h / 2;
  const autoEnd = mid - automationDelta * scale;
  const augEnd = mid - augmentationDelta * scale;

  return (
    <svg width={w} height={h} className="flex-shrink-0" aria-hidden>
      <line x1={pad} y1={mid} x2={w - pad} y2={mid} stroke="rgba(38,37,30,0.06)" strokeWidth={0.5} />
      <line x1={pad} y1={mid} x2={w - pad} y2={autoEnd} stroke={AUTOMATION_COLOR} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      <circle cx={w - pad} cy={autoEnd} r={1.5} fill={AUTOMATION_COLOR} />
      <line x1={pad} y1={mid} x2={w - pad} y2={augEnd} stroke={AUGMENTATION_COLOR} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      <circle cx={w - pad} cy={augEnd} r={1.5} fill={AUGMENTATION_COLOR} />
    </svg>
  );
}

// ── Before / After bars (v1 → v4 for role movers) ──────────
function BeforeAfterBars({
  autoBefore,
  autoAfter,
  augBefore,
  augAfter,
  total,
}: {
  autoBefore: number;
  autoAfter: number;
  augBefore: number;
  augAfter: number;
  total: number;
}) {
  if (total <= 0) return null;
  const bAI = autoBefore + augBefore;
  const aAI = autoAfter + augAfter;
  const beforeW = (bAI / total) * 100;
  const afterW = (aAI / total) * 100;
  const autoBeforeSplit = bAI > 0 ? (autoBefore / bAI) * 100 : 0;
  const autoAfterSplit = aAI > 0 ? (autoAfter / aAI) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-5 text-right text-[9px] font-medium text-[rgba(38,37,30,0.3)]">v1</span>
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[rgba(38,37,30,0.05)]">
          <div className="flex h-full rounded-full" style={{ width: `${Math.min(beforeW, 100)}%` }}>
            {autoBefore > 0 && (
              <div className="flex-none" style={{ width: `${autoBeforeSplit}%`, backgroundColor: AUTOMATION_COLOR, opacity: 0.4, minWidth: "2px" }} />
            )}
            {augBefore > 0 && (
              <div className="flex-none" style={{ width: `${100 - autoBeforeSplit}%`, backgroundColor: AUGMENTATION_COLOR, opacity: 0.4, minWidth: "2px" }} />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 text-right text-[9px] font-semibold text-[rgba(245,78,0,0.55)]">v4</span>
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[rgba(38,37,30,0.05)]">
          <div className="flex h-full rounded-full shadow-[0_2px_8px_rgba(245,78,0,0.12)]" style={{ width: `${Math.min(afterW, 100)}%` }}>
            {autoAfter > 0 && (
              <div className="flex-none" style={{ width: `${autoAfterSplit}%`, backgroundColor: AUTOMATION_COLOR, minWidth: "2px" }} />
            )}
            {augAfter > 0 && (
              <div className="flex-none" style={{ width: `${100 - autoAfterSplit}%`, backgroundColor: AUGMENTATION_COLOR, minWidth: "2px" }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slope / Trajectory chart (v1 → v4 multi-line) ──────────
type SlopeLine = { key: string; label: string; v1: number; v4: number };

function SlopeChart({
  lines,
  highlightedKey,
  onHighlight,
  yLabel,
}: {
  lines: SlopeLine[];
  highlightedKey: string | null;
  onHighlight: (key: string | null) => void;
  yLabel?: string;
}) {
  if (lines.length === 0) return null;

  const W = 680, H = 300;
  const padL = 48, padR = 130, padT = 20, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allVals = lines.flatMap((l) => [l.v1, l.v4]);
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 0.01;
  const yPad = yRange * 0.15;
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const toY = (v: number) => padT + plotH * (1 - (v - yLow) / (yHigh - yLow));
  const x1 = padL;
  const x2 = padL + plotW;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => yLow + ((yHigh - yLow) / (tickCount - 1)) * i);
  const isSmallScale = yMax < 2;

  const grey = lines.filter((l) => l.key !== highlightedKey);
  const hi = lines.find((l) => l.key === highlightedKey);

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] p-4 shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis label */}
        {yLabel && (
          <text x={6} y={padT + plotH / 2} textAnchor="middle" fill="rgba(38,37,30,0.25)" fontSize={8} fontFamily="system-ui" transform={`rotate(-90, 6, ${padT + plotH / 2})`}>
            {yLabel}
          </text>
        )}

        {/* Grid + Y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={toY(t)} x2={padL + plotW} y2={toY(t)} stroke="rgba(38,37,30,0.05)" strokeWidth={1} />
            <text x={padL - 6} y={toY(t) + 3.5} textAnchor="end" fill="rgba(38,37,30,0.3)" fontSize={9} fontFamily="system-ui">
              {isSmallScale ? t.toFixed(3) : Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}

        {/* X labels */}
        <text x={x1} y={H - 6} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui">Jan 2025</text>
        <text x={x2} y={H - 6} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui">Nov 2025</text>

        {/* Vertical axes */}
        <line x1={x1} y1={padT} x2={x1} y2={padT + plotH} stroke="rgba(38,37,30,0.08)" strokeWidth={1} />
        <line x1={x2} y1={padT} x2={x2} y2={padT + plotH} stroke="rgba(38,37,30,0.08)" strokeWidth={1} />

        {/* Grey lines */}
        {grey.map((l) => (
          <g key={l.key} className="cursor-pointer" opacity={hi ? 0.1 : 0.3} onClick={() => onHighlight(l.key)}>
            <line x1={x1} y1={toY(l.v1)} x2={x2} y2={toY(l.v4)} stroke="rgba(38,37,30,0.5)" strokeWidth={1.5} strokeLinecap="round" />
            <circle cx={x1} cy={toY(l.v1)} r={2.5} fill="rgba(38,37,30,0.3)" />
            <circle cx={x2} cy={toY(l.v4)} r={2.5} fill="rgba(38,37,30,0.3)" />
            {!hi && (
              <text x={x2 + 6} y={toY(l.v4) + 3.5} fill="rgba(38,37,30,0.3)" fontSize={8.5} fontFamily="system-ui">
                {l.label.length > 18 ? l.label.slice(0, 16) + "\u2026" : l.label}
              </text>
            )}
          </g>
        ))}

        {/* Highlighted line */}
        {hi && (
          <g className="cursor-pointer" onClick={() => onHighlight(null)}>
            <line x1={x1} y1={toY(hi.v1)} x2={x2} y2={toY(hi.v4)} stroke={AUGMENTATION_COLOR} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={x1} cy={toY(hi.v1)} r={4.5} fill={AUGMENTATION_COLOR} stroke="white" strokeWidth={2} />
            <circle cx={x2} cy={toY(hi.v4)} r={4.5} fill={AUGMENTATION_COLOR} stroke="white" strokeWidth={2} />
            <text x={x2 + 8} y={toY(hi.v4) + 4} fill="#26251e" fontSize={11} fontWeight={600} fontFamily="system-ui">{hi.label}</text>
            <text x={x1 - 4} y={toY(hi.v1) - 8} textAnchor="end" fill="rgba(38,37,30,0.5)" fontSize={9} fontFamily="system-ui">
              {isSmallScale ? hi.v1.toFixed(3) : Math.round(hi.v1)}
            </text>
            <text x={x2 + 4} y={toY(hi.v4) - 8} fill="rgba(38,37,30,0.5)" fontSize={9} fontFamily="system-ui">
              {isSmallScale ? hi.v4.toFixed(3) : Math.round(hi.v4)}
            </text>
          </g>
        )}
      </svg>

      {/* Selectable pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lines.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => onHighlight(highlightedKey === l.key ? null : l.key)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
              highlightedKey === l.key
                ? "border-[rgba(245,78,0,0.4)] bg-[rgba(245,78,0,0.08)] font-semibold text-[hsl(22deg_90%_42%)]"
                : highlightedKey
                  ? "border-[rgba(38,37,30,0.06)] text-[rgba(38,37,30,0.25)] hover:text-[rgba(38,37,30,0.4)]"
                  : "border-[rgba(38,37,30,0.1)] bg-white/50 text-[rgba(38,37,30,0.5)] hover:border-[rgba(38,37,30,0.25)]"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Constants ───────────────────────────────────────────────
const COUNTRY_PREVIEW = 8;
const COMPANY_PREVIEW = 8;
const MOVER_PREVIEW = 8;

// ─────────────────────────────────────────────────────────────
export function WhatsChanged({ movers, summary, transitions, analytics }: WhatsChangedProps) {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showAllMovers, setShowAllMovers] = useState(false);
  const [companyView, setCompanyView] = useState<"winners" | "losers" | "shift">("winners");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);
  const [highlightedIndustry, setHighlightedIndustry] = useState<string | null>(null);

  if (movers.length === 0) return null;

  const autoDelta = summary.automationAfter - summary.automationBefore;
  const augDelta = summary.augmentationAfter - summary.augmentationBefore;
  const manualDelta = summary.manualAfter - summary.manualBefore;
  const autoPctChange = formatPctChange(summary.automationBefore, summary.automationAfter);
  const augPctChange = formatPctChange(summary.augmentationBefore, summary.augmentationAfter);
  const manualPctChange = formatPctChange(summary.manualBefore, summary.manualAfter);

  // Country data
  const countries = analytics?.countries ?? [];
  const countriesWithDeltas = countries.filter((c) => c.netExposureDelta != null && c.netExposureDelta !== 0);
  const countryHasToggle = countriesWithDeltas.length > COUNTRY_PREVIEW;
  const displayedCountries = showAllCountries ? countriesWithDeltas : countriesWithDeltas.slice(0, COUNTRY_PREVIEW);

  // Company data
  const companies = analytics?.companies ?? [];
  const companiesIncreased = companies.filter((c) => c.netAIDelta > 0);
  const companiesDecreased = companies.filter((c) => c.netAIDelta < 0);
  const companiesByShift = [...companies].sort(
    (a, b) => Math.abs(b.augmentationDelta - b.automationDelta) - Math.abs(a.augmentationDelta - a.automationDelta)
  );
  const activeCompanies = companyView === "winners" ? companiesIncreased : companyView === "losers" ? companiesDecreased : companiesByShift;
  const companyHasToggle = activeCompanies.length > COMPANY_PREVIEW;
  const displayedCompanies = showAllCompanies ? activeCompanies : activeCompanies.slice(0, COMPANY_PREVIEW);

  // Top reclassified tasks
  const displayedReclassified = showAllTasks ? transitions.topReclassifiedTasks : transitions.topReclassifiedTasks.slice(0, 5);

  // Movers
  const moverHasToggle = movers.length > MOVER_PREVIEW;
  const displayedMovers = showAllMovers ? movers : movers.slice(0, MOVER_PREVIEW);

  // Narrative
  const autoToAugCount = transitions.transitions.find((t) => t.from === "automation" && t.to === "augmentation")?.count ?? 0;
  const manualToAugCount = transitions.transitions.find((t) => t.from === "manual" && t.to === "augmentation")?.count ?? 0;

  // ── Sparkline normalisation ─────────────────────────────
  const companyMaxDelta = Math.max(...companies.map((c) => Math.max(Math.abs(c.automationDelta), Math.abs(c.augmentationDelta))), 0.001);
  const countryMaxDelta = Math.max(...countriesWithDeltas.map((c) => Math.max(Math.abs(c.automationDelta ?? 0), Math.abs(c.augmentationDelta ?? 0))), 0.001);

  // ── Trajectory chart data ───────────────────────────────
  const analyticsIndustries = analytics?.industries ?? [];
  const industryTrajectory: SlopeLine[] = analyticsIndustries
    .filter((i) => i.netExposureDelta != null && i.averageAutomation != null && i.averageAugmentation != null)
    .map((i) => {
      const v4 = (i.averageAutomation ?? 0) + (i.averageAugmentation ?? 0);
      const v1 = v4 - (i.netExposureDelta ?? 0);
      return { key: i.industry, label: i.industry, v1, v4 };
    })
    .filter((l) => Math.abs(l.v4 - l.v1) > 0.0001);

  const countryTrajectory: SlopeLine[] = countriesWithDeltas
    .filter((c) => c.averageAutomation != null && c.averageAugmentation != null)
    .map((c) => {
      const v4 = (c.averageAutomation ?? 0) + (c.averageAugmentation ?? 0);
      const v1 = v4 - (c.netExposureDelta ?? 0);
      return { key: c.country, label: c.country, v1, v4 };
    });

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(245,78,0,0.06),_transparent_60%)]" />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
            Jan 2025 → Nov 2025
          </p>
          <h2 className="mt-2 text-xl font-medium text-[#26251e] sm:text-2xl">
            What changed in AI task coverage
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[rgba(38,37,30,0.6)]">
            The v4 update tells one dominant story: AI is shifting from
            &ldquo;replacing humans&rdquo; to &ldquo;working with humans.&rdquo;
            Based on Anthropic&apos;s{" "}
            <a
              href="https://www.anthropic.com/research/the-anthropic-economic-index"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[rgba(245,78,0,0.85)] underline decoration-[rgba(245,78,0,0.4)] underline-offset-4 transition-colors hover:text-[rgba(245,78,0,1)]"
            >
              Economic Index
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(38,37,30,0.45)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: AUTOMATION_COLOR }}
            />
            Automation
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: AUGMENTATION_COLOR }}
            />
            Augmentation
          </span>
        </div>
      </header>

      {/* ── Big Picture ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
            Roles analyzed
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
            {summary.totalRoles.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
            Task-role combos
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
            {transitions.totalTaskRoleCombinations.toLocaleString()}
          </p>
        </div>
        {analytics && (
          <>
            <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
                Companies
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
                {analytics.coverage.companies.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
                Workers represented
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
                {formatHeadcount(analytics.coverage.totalHeadcount)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── V1→V4 Metrics Change Table ── */}
      <Section title="V1 → V4 task classification changes">
        <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(38,37,30,0.08)] text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(38,37,30,0.45)]">
                <th className="px-5 py-3">Metric</th>
                <th className="px-5 py-3 text-right">V1 (Jan 2025)</th>
                <th className="px-5 py-3 text-right">V4 (Nov 2025)</th>
                <th className="px-5 py-3 text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(38,37,30,0.06)]">
              <tr>
                <td className="px-5 py-3 font-medium text-[#26251e]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AUTOMATION_COLOR }} />
                    Automation tasks
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.automationBefore.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.automationAfter.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                    style={{
                      backgroundColor: autoDelta < 0 ? "rgba(38,37,30,0.06)" : "rgba(245,78,0,0.08)",
                      color: autoDelta < 0 ? "rgba(38,37,30,0.55)" : "hsl(22deg 90% 42%)",
                    }}
                  >
                    {formatDelta(autoDelta)} ({autoPctChange}%)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-[#26251e]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AUGMENTATION_COLOR }} />
                    Augmentation tasks
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.augmentationBefore.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.augmentationAfter.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                    style={{
                      backgroundColor: augDelta > 0 ? "rgba(245,78,0,0.08)" : "rgba(38,37,30,0.06)",
                      color: augDelta > 0 ? "hsl(22deg 90% 42%)" : "rgba(38,37,30,0.55)",
                    }}
                  >
                    {formatDelta(augDelta)} ({augPctChange}%)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-[#26251e]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MANUAL_COLOR }} />
                    Manual tasks
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.manualBefore.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[rgba(38,37,30,0.6)]">
                  {summary.manualAfter.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                    style={{
                      backgroundColor: "rgba(38,37,30,0.06)",
                      color: "rgba(38,37,30,0.55)",
                    }}
                  >
                    {formatDelta(manualDelta)} ({manualPctChange}%)
                  </span>
                </td>
              </tr>
              <tr className="bg-[rgba(38,37,30,0.02)]">
                <td className="px-5 py-3 font-medium text-[#26251e]">
                  Roles changed
                </td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-semibold tabular-nums text-[#26251e]">
                    {summary.rolesWithChanges.toLocaleString()} of {summary.totalRoles.toLocaleString()}
                  </span>
                  <span className="ml-1.5 text-xs text-[rgba(38,37,30,0.45)]">
                    ({Math.round((summary.rolesWithChanges / summary.totalRoles) * 100)}%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Industry Trajectory ── */}
      {industryTrajectory.length > 0 && (
        <Section title="Industry trajectory (avg AI exposure, v1 → v4)">
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Each line is one industry. Click to highlight and compare trajectories.
          </p>
          <SlopeChart
            lines={industryTrajectory}
            highlightedKey={highlightedIndustry}
            onHighlight={setHighlightedIndustry}
            yLabel="Avg AI exposure"
          />
        </Section>
      )}

      {/* ── Company Impact ── */}
      {companies.length > 0 && (
        <Section title="Company impact (HC-weighted)">
          <div className="mb-4 -mt-2 flex flex-wrap items-center gap-2 text-sm text-[rgba(38,37,30,0.55)]">
            <span>
              {companiesIncreased.length.toLocaleString()} companies ({Math.round((companiesIncreased.length / companies.length) * 100)}%) see increased AI exposure.{" "}
            </span>
          </div>

          {/* View toggles */}
          <div className="mb-4 flex gap-2">
            {(
              [
                { key: "winners", label: `Most increased (${companiesIncreased.length})` },
                { key: "losers", label: `Decreased (${companiesDecreased.length})` },
                { key: "shift", label: "Biggest auto\u2192aug shift" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCompanyView(key);
                  setShowAllCompanies(false);
                }}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  companyView === key
                    ? "border-[rgba(245,78,0,0.3)] bg-[rgba(245,78,0,0.06)] text-[hsl(22deg_90%_42%)]"
                    : "border-[rgba(38,37,30,0.12)] bg-white/60 text-[rgba(38,37,30,0.5)] hover:border-[rgba(38,37,30,0.25)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
            {/* Table header */}
            <div className="hidden items-center border-b border-[rgba(38,37,30,0.08)] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(38,37,30,0.45)] sm:flex">
              <span className="w-8 text-right">#</span>
              <span className="flex-1 pl-3">Company</span>
              <span className="w-16 text-right">HC</span>
              <span className="w-14 text-center">Trend</span>
              <span className="w-20 text-right">Net AI &Delta;</span>
              <span className="w-20 text-right">Auto &Delta;</span>
              <span className="w-20 text-right">Aug &Delta;</span>
            </div>
            <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
              {displayedCompanies.map((company, idx) => (
                <li key={company.name} className="px-5 py-3 sm:px-5">
                  {/* Mobile */}
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:hidden">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold tabular-nums text-[rgba(38,37,30,0.3)]">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-[#26251e]">
                        {company.name}
                      </span>
                      <span className="text-[10px] text-[rgba(38,37,30,0.4)]">
                        {formatHeadcount(company.headcount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkline
                        automationDelta={company.automationDelta}
                        augmentationDelta={company.augmentationDelta}
                        maxAbsDelta={companyMaxDelta}
                      />
                      <DeltaPill value={company.netAIDelta} label="net" decimals />
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden items-center sm:flex">
                    <span className="w-8 text-right text-xs font-semibold tabular-nums text-[rgba(38,37,30,0.3)]">
                      {idx + 1}
                    </span>
                    <span className="flex-1 pl-3 text-sm font-medium text-[#26251e]">
                      {company.name}
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-[rgba(38,37,30,0.5)]">
                      {formatHeadcount(company.headcount)}
                    </span>
                    <span className="flex w-14 justify-center">
                      <Sparkline
                        automationDelta={company.automationDelta}
                        augmentationDelta={company.augmentationDelta}
                        maxAbsDelta={companyMaxDelta}
                      />
                    </span>
                    <span className="w-20 text-right">
                      <DeltaPill value={company.netAIDelta} label="" decimals />
                    </span>
                    <span
                      className="w-20 text-right text-xs font-semibold tabular-nums"
                      style={{ color: AUTOMATION_COLOR }}
                    >
                      {formatDecimal(company.automationDelta)}
                    </span>
                    <span
                      className="w-20 text-right text-xs font-semibold tabular-nums"
                      style={{ color: AUGMENTATION_COLOR }}
                    >
                      {formatDecimal(company.augmentationDelta)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {companyHasToggle && (
              <div className="flex justify-center py-3">
                <ToggleButton
                  expanded={showAllCompanies}
                  totalCount={activeCompanies.length}
                  onToggle={() => setShowAllCompanies((v) => !v)}
                />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Country Impact ── */}
      {countriesWithDeltas.length > 0 && (
        <Section title="Country impact (HC-weighted)">
          <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
            {/* Table header */}
            <div className="hidden items-center border-b border-[rgba(38,37,30,0.08)] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(38,37,30,0.45)] sm:flex">
              <span className="flex-1">Country</span>
              <span className="w-14 text-right">Cos</span>
              <span className="w-16 text-right">HC</span>
              <span className="w-14 text-center">Trend</span>
              <span className="w-20 text-right">Net AI &Delta;</span>
              <span className="w-20 text-right">Auto &Delta;</span>
              <span className="w-20 text-right">Aug &Delta;</span>
            </div>
            <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
              {displayedCountries.map((c) => (
                <li key={c.country} className="px-5 py-3">
                  {/* Mobile */}
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:hidden">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[#26251e]">{c.country}</span>
                      <span className="text-[10px] text-[rgba(38,37,30,0.4)]">
                        {c.runCount} cos
                        {c.averageHeadcount ? ` \u00B7 ${formatHeadcount(c.averageHeadcount * c.runCount)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkline
                        automationDelta={c.automationDelta ?? 0}
                        augmentationDelta={c.augmentationDelta ?? 0}
                        maxAbsDelta={countryMaxDelta}
                      />
                      <DeltaPill value={c.netExposureDelta ?? 0} label="net" decimals />
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden items-center sm:flex">
                    <span className="flex-1 text-sm font-medium text-[#26251e]">{c.country}</span>
                    <span className="w-14 text-right text-xs tabular-nums text-[rgba(38,37,30,0.5)]">
                      {c.runCount}
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-[rgba(38,37,30,0.5)]">
                      {c.averageHeadcount ? formatHeadcount(c.averageHeadcount * c.runCount) : "\u2014"}
                    </span>
                    <span className="flex w-14 justify-center">
                      <Sparkline
                        automationDelta={c.automationDelta ?? 0}
                        augmentationDelta={c.augmentationDelta ?? 0}
                        maxAbsDelta={countryMaxDelta}
                      />
                    </span>
                    <span className="w-20 text-right">
                      <DeltaPill value={c.netExposureDelta ?? 0} label="" decimals />
                    </span>
                    <span
                      className="w-20 text-right text-xs font-semibold tabular-nums"
                      style={{ color: AUTOMATION_COLOR }}
                    >
                      {c.automationDelta != null ? formatDecimal(c.automationDelta) : "\u2014"}
                    </span>
                    <span
                      className="w-20 text-right text-xs font-semibold tabular-nums"
                      style={{ color: AUGMENTATION_COLOR }}
                    >
                      {c.augmentationDelta != null ? formatDecimal(c.augmentationDelta) : "\u2014"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {countryHasToggle && (
              <div className="flex justify-center py-3">
                <ToggleButton
                  expanded={showAllCountries}
                  totalCount={countriesWithDeltas.length}
                  onToggle={() => setShowAllCountries((v) => !v)}
                />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Country Trajectory ── */}
      {countryTrajectory.length > 0 && (
        <Section title="Country trajectory (avg AI exposure, v1 → v4)">
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Each line is one country. Click to highlight and compare trajectories.
          </p>
          <SlopeChart
            lines={countryTrajectory}
            highlightedKey={highlightedCountry}
            onHighlight={setHighlightedCountry}
            yLabel="Avg AI exposure"
          />
        </Section>
      )}

      {/* ── Role-Level Biggest Movers ── */}
      <Section title="Role-level biggest movers">
        <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
          <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
            {displayedMovers.map((mover, index) => {
              const aiTasksBefore =
                mover.automationTasksBefore + mover.augmentationTasksBefore;
              const aiTasksAfter =
                mover.automationTasksAfter + mover.augmentationTasksAfter;
              const netDelta = aiTasksAfter - aiTasksBefore;
              const aiPct =
                mover.taskCount > 0
                  ? Math.round((aiTasksAfter / mover.taskCount) * 100)
                  : 0;

              const story = buildMoverStory(mover);

              return (
                <li key={mover.code} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="flex-shrink-0 pt-0.5 text-right text-base font-semibold tracking-[0.18em] text-[rgba(38,37,30,0.3)]">
                      {(index + 1).toString().padStart(2, "\u2007")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-[#26251e]">
                            {mover.title}
                          </span>
                          {mover.parentCluster && (
                            <span className="ml-2 text-[10px] text-[rgba(38,37,30,0.4)]">
                              {mover.parentCluster}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[rgba(38,37,30,0.55)]">
                          <span className="font-mono">
                            {aiTasksAfter} of {mover.taskCount} tasks
                          </span>
                          <span className="font-mono text-[rgba(38,37,30,0.38)]">
                            {aiPct}%
                          </span>
                          {netDelta !== 0 && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor:
                                  netDelta > 0
                                    ? "rgba(245,78,0,0.08)"
                                    : "rgba(38,37,30,0.06)",
                                color:
                                  netDelta > 0
                                    ? "hsl(22deg 90% 42%)"
                                    : "rgba(38,37,30,0.55)",
                              }}
                            >
                              {netDelta > 0 ? "+" : ""}
                              {netDelta} task{Math.abs(netDelta) !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Before/after breakdown text */}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] font-semibold tabular-nums">
                        <span style={{ color: AUTOMATION_COLOR }}>
                          Auto: {mover.automationTasksBefore} → {mover.automationTasksAfter}
                          {mover.automationDelta !== 0 && (
                            <span className="ml-1 opacity-60">
                              ({mover.automationDelta > 0 ? "+" : ""}{mover.automationDelta})
                            </span>
                          )}
                        </span>
                        <span style={{ color: AUGMENTATION_COLOR }}>
                          Aug: {mover.augmentationTasksBefore} → {mover.augmentationTasksAfter}
                          {mover.augmentationDelta !== 0 && (
                            <span className="ml-1 opacity-60">
                              ({mover.augmentationDelta > 0 ? "+" : ""}{mover.augmentationDelta})
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Before/After visual bars */}
                      <div className="mt-2.5">
                        <BeforeAfterBars
                          autoBefore={mover.automationTasksBefore}
                          autoAfter={mover.automationTasksAfter}
                          augBefore={mover.augmentationTasksBefore}
                          augAfter={mover.augmentationTasksAfter}
                          total={mover.taskCount}
                        />
                      </div>

                      {story && (
                        <p className="mt-2 text-[11px] italic leading-relaxed text-[rgba(38,37,30,0.45)]">
                          {story}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {moverHasToggle && (
            <div className="flex justify-center py-3">
              <ToggleButton
                expanded={showAllMovers}
                totalCount={movers.length}
                onToggle={() => setShowAllMovers((v) => !v)}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── Task-Level Patterns ── */}
      {transitions.topReclassifiedTasks.length > 0 && (
        <Section title="Most commonly reclassified tasks">
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Tasks that changed category across the most roles. These are collaborative,
            judgment-heavy tasks where AI can now assist but can&apos;t replace the human.
          </p>
          <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
            <ul className="divide-y divide-[rgba(38,37,30,0.06)]">
              {displayedReclassified.map((task) => {
                const maxRoles = transitions.topReclassifiedTasks[0]?.roleCount ?? 1;
                const barW = Math.max((task.roleCount / maxRoles) * 100, 3);

                return (
                  <li key={task.taskName} className="px-5 py-3.5 sm:px-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm text-[#26251e]">
                        {task.taskName}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] tabular-nums">
                        <span className="font-medium text-[rgba(38,37,30,0.5)]">
                          {task.roleCount} role{task.roleCount !== 1 ? "s" : ""}
                        </span>
                        <span className="rounded-full bg-[rgba(38,37,30,0.05)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[rgba(38,37,30,0.45)]">
                          {task.dominantTransition}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${barW}%`,
                          backgroundColor: task.dominantTransition.includes("augmentation")
                            ? AUGMENTATION_COLOR
                            : task.dominantTransition.includes("automation")
                              ? AUTOMATION_COLOR
                              : MANUAL_COLOR,
                          opacity: 0.5,
                          minWidth: "4px",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {transitions.topReclassifiedTasks.length > 5 && (
              <div className="flex justify-center py-3">
                <ToggleButton
                  expanded={showAllTasks}
                  totalCount={transitions.topReclassifiedTasks.length}
                  onToggle={() => setShowAllTasks((v) => !v)}
                />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Summary Narrative ── */}
      <Section title="Summary">
        <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-6 py-5">
          <ol className="list-inside list-decimal space-y-3 text-sm leading-relaxed text-[rgba(38,37,30,0.7)]">
            <li>
              <strong className="text-[#26251e]">The augmentation story is 4x larger than automation.</strong>{" "}
              Net augmentation tasks gained ({formatDelta(augDelta)}) dwarf net automation tasks lost ({formatDelta(autoDelta)}).
              AI is becoming a collaborator, not a replacer.
            </li>
            <li>
              <strong className="text-[#26251e]">Knowledge work saw the biggest shift.</strong>{" "}
              Computer &amp; Math, Business &amp; Finance, Education — these sectors saw tasks
              reclassified from &ldquo;AI can do this alone&rdquo; to &ldquo;AI works best with a human.&rdquo;
            </li>
            <li>
              <strong className="text-[#26251e]">Physical/manual work barely changed.</strong>{" "}
              Production, Protective Service, Construction — minimal movement. AI&apos;s impact on physical
              tasks hasn&apos;t meaningfully evolved.
            </li>
            {analytics && companies.length > 0 && (
              <li>
                <strong className="text-[#26251e]">
                  {companiesIncreased.length} of {companies.length} companies ({Math.round((companiesIncreased.length / companies.length) * 100)}%) see increased AI exposure.
                </strong>{" "}
                But the shift is toward augmentation, not job loss.
              </li>
            )}
            {manualToAugCount > 0 && autoToAugCount > 0 && (
              <li>
                <strong className="text-[#26251e]">
                  {manualToAugCount.toLocaleString()} tasks moved manual → augmentation,{" "}
                  {autoToAugCount.toLocaleString()} moved automation → augmentation.
                </strong>{" "}
                The net flow is universal: tasks moving toward human-AI collaboration from both directions.
              </li>
            )}
          </ol>
        </div>
      </Section>
    </section>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function DeltaPill({
  value,
  label,
  decimals,
}: {
  value: number;
  label?: string;
  decimals?: boolean;
}) {
  if (value === 0) return null;
  const formatted = decimals ? formatDecimal(value) : formatDelta(value);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{
        backgroundColor:
          value > 0 ? "rgba(245,78,0,0.08)" : "rgba(38,37,30,0.06)",
        color:
          value > 0 ? "hsl(22deg 90% 42%)" : "rgba(38,37,30,0.55)",
      }}
    >
      {formatted}
      {label && <span className="opacity-70">{label}</span>}
    </span>
  );
}

function ToggleButton({
  expanded,
  totalCount,
  onToggle,
}: {
  expanded: boolean;
  totalCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(38,37,30,0.18)] bg-white/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-[rgba(38,37,30,0.6)] transition-shadow duration-200 hover:shadow-[0_12px_26px_rgba(34,28,20,0.16)]"
    >
      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
      {expanded ? "Collapse" : `Show all ${totalCount}`}
    </button>
  );
}

function buildMoverStory(mover: TopMover): string | null {
  const autoDelta = mover.automationDelta;
  const augDelta = mover.augmentationDelta;
  const manualDelta = mover.taskCount - (mover.automationTasksAfter + mover.augmentationTasksAfter) -
    (mover.taskCount - (mover.automationTasksBefore + mover.augmentationTasksBefore));

  if (autoDelta < 0 && augDelta > 0 && Math.abs(manualDelta) <= 1 && Math.abs(autoDelta) === augDelta) {
    return "Pure automation \u2192 augmentation flip";
  }
  if (autoDelta < -3) {
    if (augDelta > 0 && manualDelta > 0) {
      return "Biggest single automation loss \u2014 tasks split to augmentation and manual";
    }
    if (augDelta > 0) {
      return "Strong automation \u2192 augmentation shift";
    }
  }
  if (autoDelta > 0 && augDelta > 0) {
    return "AI now helps AND does more tasks";
  }
  if (autoDelta < 0 && manualDelta > 0 && augDelta >= 0) {
    return "Some automation tasks reverted to manual";
  }
  if (augDelta > 3) {
    return "Strong augmentation gain";
  }
  if (autoDelta < 0 && augDelta > 0) {
    return "Automation \u2192 augmentation shift";
  }
  return null;
}
