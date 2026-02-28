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
  /** v4 (current) analytics — primary data source */
  analytics: ComparativeAnalytics | null;
  /** v3 (Sep 2025) analytics — mid-point for trajectory charts */
  analyticsV3?: ComparativeAnalytics | null;
  /** v1 (Jan 2025) analytics — baseline for trajectory charts */
  analyticsV1?: ComparativeAnalytics | null;
  /** Active timeline vintage (2025.0 = v1, 2025.7 = v3, 2025.9 = v4) */
  activeVintage?: number;
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

// ── Slope / Trajectory chart (v1 → v3 → v4 multi-line) ─────
type SlopeLine = { key: string; label: string; v1: number; v3?: number; v4: number };

function SlopeChart({
  lines,
  highlightedKey,
  onHighlight,
  yLabel,
  endLabel,
}: {
  lines: SlopeLine[];
  highlightedKey: string | null;
  onHighlight: (key: string | null) => void;
  yLabel?: string;
  endLabel?: string;
}) {
  const [pillsExpanded, setPillsExpanded] = useState(false);
  if (lines.length === 0) return null;

  const hasV3 = lines.some((l) => l.v3 != null);

  const W = 680, H = 300;
  const padL = 48, padR = 130, padT = 20, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allVals = lines.flatMap((l) => [l.v1, ...(l.v3 != null ? [l.v3] : []), l.v4]);
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 0.01;
  const yPad = yRange * 0.15;
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const toY = (v: number) => padT + plotH * (1 - (v - yLow) / (yHigh - yLow));
  const x1 = padL;
  const x2 = padL + plotW;
  // v3 positioned proportionally: Sep 2025 is ~8/10 of the way from Jan to Nov
  const xMid = hasV3 ? padL + plotW * (8 / 10) : 0;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => yLow + ((yHigh - yLow) / (tickCount - 1)) * i);
  const isSmallScale = yMax < 2;

  const grey = lines.filter((l) => l.key !== highlightedKey);
  const hi = lines.find((l) => l.key === highlightedKey);

  const polyPoints = (l: SlopeLine) =>
    l.v3 != null
      ? `${x1},${toY(l.v1)} ${xMid},${toY(l.v3)} ${x2},${toY(l.v4)}`
      : `${x1},${toY(l.v1)} ${x2},${toY(l.v4)}`;

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
        {hasV3 && (
          <text x={xMid} y={H - 6} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui">Sep 2025</text>
        )}
        <text x={x2} y={H - 6} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui">{endLabel ?? "Nov 2025"}</text>

        {/* Vertical axes */}
        <line x1={x1} y1={padT} x2={x1} y2={padT + plotH} stroke="rgba(38,37,30,0.08)" strokeWidth={1} />
        {hasV3 && <line x1={xMid} y1={padT} x2={xMid} y2={padT + plotH} stroke="rgba(38,37,30,0.05)" strokeWidth={1} strokeDasharray="3 3" />}
        <line x1={x2} y1={padT} x2={x2} y2={padT + plotH} stroke="rgba(38,37,30,0.08)" strokeWidth={1} />

        {/* Grey lines */}
        {grey.map((l) => (
          <g key={l.key} className="cursor-pointer" opacity={hi ? 0.1 : 0.3} onClick={() => onHighlight(l.key)}>
            <polyline points={polyPoints(l)} fill="none" stroke="rgba(38,37,30,0.5)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={x1} cy={toY(l.v1)} r={2.5} fill="rgba(38,37,30,0.3)" />
            {l.v3 != null && <circle cx={xMid} cy={toY(l.v3)} r={2} fill="rgba(38,37,30,0.2)" />}
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
            <polyline points={polyPoints(hi)} fill="none" stroke={AUGMENTATION_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={x1} cy={toY(hi.v1)} r={4.5} fill={AUGMENTATION_COLOR} stroke="white" strokeWidth={2} />
            {hi.v3 != null && <circle cx={xMid} cy={toY(hi.v3)} r={4} fill={AUGMENTATION_COLOR} stroke="white" strokeWidth={2} />}
            <circle cx={x2} cy={toY(hi.v4)} r={4.5} fill={AUGMENTATION_COLOR} stroke="white" strokeWidth={2} />
            <text x={x2 + 8} y={toY(hi.v4) + 4} fill="#26251e" fontSize={11} fontWeight={600} fontFamily="system-ui">{hi.label}</text>
            <text x={x1 - 4} y={toY(hi.v1) - 8} textAnchor="end" fill="rgba(38,37,30,0.5)" fontSize={9} fontFamily="system-ui">
              {isSmallScale ? hi.v1.toFixed(3) : Math.round(hi.v1)}
            </text>
            {hi.v3 != null && (
              <text x={xMid} y={toY(hi.v3) - 8} textAnchor="middle" fill="rgba(38,37,30,0.4)" fontSize={8} fontFamily="system-ui">
                {isSmallScale ? hi.v3.toFixed(3) : Math.round(hi.v3)}
              </text>
            )}
            <text x={x2 + 4} y={toY(hi.v4) - 8} fill="rgba(38,37,30,0.5)" fontSize={9} fontFamily="system-ui">
              {isSmallScale ? hi.v4.toFixed(3) : Math.round(hi.v4)}
            </text>
          </g>
        )}
      </svg>

      {/* Selectable pills (truncated: first 5 … last 5) */}
      {(() => {
        const PILL_CAP = 5;
        const needsTruncation = lines.length > PILL_CAP * 2 + 1 && !pillsExpanded;
        const visiblePills = needsTruncation
          ? [...lines.slice(0, PILL_CAP), null, ...lines.slice(-PILL_CAP)]
          : lines;

        const pillBtn = (l: SlopeLine) => (
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
        );

        return (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {visiblePills.map((item, i) =>
              item === null ? (
                <button
                  key="__expand__"
                  type="button"
                  onClick={() => setPillsExpanded(true)}
                  className="rounded-full border border-[rgba(38,37,30,0.12)] bg-white/60 px-2.5 py-1 text-[10px] font-semibold text-[rgba(38,37,30,0.4)] transition-all hover:border-[rgba(38,37,30,0.25)] hover:text-[rgba(38,37,30,0.6)]"
                >
                  +{lines.length - PILL_CAP * 2} more
                </button>
              ) : (
                pillBtn(item)
              )
            )}
            {pillsExpanded && lines.length > PILL_CAP * 2 + 1 && (
              <button
                type="button"
                onClick={() => setPillsExpanded(false)}
                className="rounded-full border border-[rgba(38,37,30,0.12)] bg-white/60 px-2.5 py-1 text-[10px] font-semibold text-[rgba(38,37,30,0.4)] transition-all hover:border-[rgba(38,37,30,0.25)] hover:text-[rgba(38,37,30,0.6)]"
              >
                Show less
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Company Scatter (Auto Δ vs Aug Δ) ───────────────────────
type ScatterPoint = {
  key: string;
  label: string;
  x: number;          // automationDelta
  y: number;          // augmentationDelta
  size: number;
  headcount: number;
  industry: string | null;
  hqCountry: string | null;
  netAIDelta: number;
};

function CompanyScatter({
  points,
  highlightedKey,
  onHighlight,
}: {
  points: ScatterPoint[];
  highlightedKey: string | null;
  onHighlight: (key: string | null) => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  if (points.length === 0) return null;

  const activeKey = highlightedKey ?? hoverKey;

  const W = 680, H = 400;
  const padL = 56, padR = 20, padT = 20, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 0.01;
  const yRange = yMax - yMin || 0.01;
  const xPad = xRange * 0.1;
  const yPad = yRange * 0.1;
  const xLow = xMin - xPad;
  const xHigh = xMax + xPad;
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const toX = (v: number) => padL + plotW * ((v - xLow) / (xHigh - xLow));
  const toY = (v: number) => padT + plotH * (1 - (v - yLow) / (yHigh - yLow));

  const xTicks = 5;
  const yTicks = 5;
  const xTickArr = Array.from({ length: xTicks }, (_, i) => xLow + ((xHigh - xLow) / (xTicks - 1)) * i);
  const yTickArr = Array.from({ length: yTicks }, (_, i) => yLow + ((yHigh - yLow) / (yTicks - 1)) * i);

  const hi = points.find((p) => p.key === activeKey);

  // Quadrant labels
  const qLabelOpacity = activeKey ? 0.08 : 0.15;

  // Classify company for insight
  const classifyCompany = (p: ScatterPoint) => {
    if (p.x > 0 && p.y > 0) return { quadrant: "Both rising", desc: "Growing AI exposure across both automation and augmentation" };
    if (p.x < 0 && p.y > 0) return { quadrant: "Shifting to augmentation", desc: "Replacing automation with human-AI collaboration" };
    if (p.x > 0 && p.y < 0) return { quadrant: "Shifting to automation", desc: "Moving toward more autonomous AI usage" };
    return { quadrant: "Both declining", desc: "Decreasing overall AI exposure" };
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(38,37,30,0.1)] bg-[rgba(255,255,255,0.68)] p-4 shadow-[0_20px_40px_rgba(34,28,20,0.08)]">
      <div className="relative" onMouseLeave={() => setHoverKey(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid */}
          {yTickArr.map((t, i) => (
            <g key={`y${i}`}>
              <line x1={padL} y1={toY(t)} x2={padL + plotW} y2={toY(t)} stroke="rgba(38,37,30,0.05)" strokeWidth={1} />
              <text x={padL - 6} y={toY(t) + 3.5} textAnchor="end" fill="rgba(38,37,30,0.3)" fontSize={9} fontFamily="system-ui">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {xTickArr.map((t, i) => (
            <g key={`x${i}`}>
              <line x1={toX(t)} y1={padT} x2={toX(t)} y2={padT + plotH} stroke="rgba(38,37,30,0.05)" strokeWidth={1} />
              <text x={toX(t)} y={H - 10} textAnchor="middle" fill="rgba(38,37,30,0.3)" fontSize={9} fontFamily="system-ui">
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Zero lines */}
          {xLow <= 0 && xHigh >= 0 && (
            <line x1={toX(0)} y1={padT} x2={toX(0)} y2={padT + plotH} stroke="rgba(38,37,30,0.15)" strokeWidth={1} strokeDasharray="4 3" />
          )}
          {yLow <= 0 && yHigh >= 0 && (
            <line x1={padL} y1={toY(0)} x2={padL + plotW} y2={toY(0)} stroke="rgba(38,37,30,0.15)" strokeWidth={1} strokeDasharray="4 3" />
          )}

          {/* Quadrant labels */}
          {xLow <= 0 && xHigh >= 0 && yLow <= 0 && yHigh >= 0 && (
            <>
              <text x={toX(xHigh * 0.6)} y={toY(yHigh * 0.7)} textAnchor="middle" fill={`rgba(38,37,30,${qLabelOpacity})`} fontSize={8} fontFamily="system-ui">
                +Auto +Aug
              </text>
              <text x={toX(xLow * 0.6)} y={toY(yHigh * 0.7)} textAnchor="middle" fill={`rgba(38,37,30,${qLabelOpacity})`} fontSize={8} fontFamily="system-ui">
                −Auto +Aug
              </text>
              <text x={toX(xHigh * 0.6)} y={toY(yLow * 0.6)} textAnchor="middle" fill={`rgba(38,37,30,${qLabelOpacity})`} fontSize={8} fontFamily="system-ui">
                +Auto −Aug
              </text>
              <text x={toX(xLow * 0.6)} y={toY(yLow * 0.6)} textAnchor="middle" fill={`rgba(38,37,30,${qLabelOpacity})`} fontSize={8} fontFamily="system-ui">
                −Auto −Aug
              </text>
            </>
          )}

          {/* Axis labels */}
          <text x={padL + plotW / 2} y={H - 1} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui">
            Automation \u0394
          </text>
          <text x={10} y={padT + plotH / 2} textAnchor="middle" fill="rgba(38,37,30,0.45)" fontSize={10} fontWeight={600} fontFamily="system-ui" transform={`rotate(-90, 10, ${padT + plotH / 2})`}>
            Augmentation \u0394
          </text>

          {/* Points */}
          {points.map((p) => {
            const isHi = p.key === activeKey;
            const hasHi = activeKey != null;
            return (
              <g
                key={p.key}
                className="cursor-pointer"
                onClick={() => onHighlight(highlightedKey === p.key ? null : p.key)}
                onMouseEnter={() => setHoverKey(p.key)}
                onMouseLeave={() => setHoverKey(null)}
              >
                {/* Invisible hit area */}
                <circle cx={toX(p.x)} cy={toY(p.y)} r={Math.max(p.size + 4, 8)} fill="transparent" />
                <circle
                  cx={toX(p.x)}
                  cy={toY(p.y)}
                  r={isHi ? 7 : Math.max(p.size, 3)}
                  fill={isHi ? AUGMENTATION_COLOR : hasHi ? "rgba(38,37,30,0.08)" : "rgba(245,78,0,0.25)"}
                  stroke={isHi ? "white" : "none"}
                  strokeWidth={isHi ? 2 : 0}
                  opacity={hasHi && !isHi ? 0.4 : 1}
                  style={{ transition: "r 150ms, fill 150ms, opacity 150ms" }}
                />
              </g>
            );
          })}

          {/* Highlighted: crosshair lines */}
          {hi && (
            <g pointerEvents="none">
              <line x1={toX(hi.x)} y1={padT} x2={toX(hi.x)} y2={padT + plotH} stroke={AUGMENTATION_COLOR} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.4} />
              <line x1={padL} y1={toY(hi.y)} x2={padL + plotW} y2={toY(hi.y)} stroke={AUGMENTATION_COLOR} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.4} />
            </g>
          )}
        </svg>

        {/* Floating tooltip near the hovered point */}
        {hi && (() => {
          const insight = classifyCompany(hi);
          const xPct = (toX(hi.x) / W) * 100;
          const yPct = (toY(hi.y) / H) * 100;
          const flipX = xPct > 55;
          const flipY = yPct > 50;
          return (
            <div
              className="pointer-events-none absolute z-20 w-64 rounded-xl border border-[rgba(38,37,30,0.12)] bg-white/95 px-4 py-3 shadow-[0_12px_32px_rgba(34,28,20,0.18)] backdrop-blur-sm"
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                transform: `translate(${flipX ? "calc(-100% - 14px)" : "14px"}, ${flipY ? "calc(-100% - 14px)" : "14px"})`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[#26251e]">{hi.label}</span>
                {hi.industry && (
                  <span className="text-[9px] text-[rgba(38,37,30,0.4)]">{hi.industry}</span>
                )}
              </div>
              {hi.hqCountry && (
                <p className="mt-0.5 text-[9px] text-[rgba(38,37,30,0.35)]">{hi.hqCountry}</p>
              )}
              <p className="mt-1.5 text-[10px] text-[rgba(38,37,30,0.5)]">
                <span className="font-semibold" style={{ color: AUGMENTATION_COLOR }}>{insight.quadrant}</span>
                {" — "}{insight.desc}
              </p>
              <div className="mt-2 flex gap-3">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[rgba(38,37,30,0.3)]">HC</p>
                  <p className="text-xs font-semibold tabular-nums text-[#26251e]">{formatHeadcount(hi.headcount)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[rgba(38,37,30,0.3)]">Net Δ</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: hi.netAIDelta > 0 ? "hsl(22deg 90% 42%)" : "rgba(38,37,30,0.55)" }}>
                    {formatDecimal(hi.netAIDelta)}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: AUTOMATION_COLOR }}>Auto</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: AUTOMATION_COLOR }}>{formatDecimal(hi.x)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: AUGMENTATION_COLOR }}>Aug</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: AUGMENTATION_COLOR }}>{formatDecimal(hi.y)}</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Constants ───────────────────────────────────────────────
const COUNTRY_PREVIEW = 8;
const COMPANY_PREVIEW = 8;

// ─────────────────────────────────────────────────────────────
export function WhatsChanged({ movers, summary, transitions, analytics, analyticsV3, analyticsV1, activeVintage = 2025.9 }: WhatsChangedProps) {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [companyView, setCompanyView] = useState<"winners" | "losers" | "shift">("winners");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [highlightedCountry, setHighlightedCountry] = useState<string>("__initial__");
  const [highlightedScatterCompany, setHighlightedScatterCompany] = useState<string | null>(null);
  const [highlightedIndustry, setHighlightedIndustry] = useState<string>("__initial__");

  if (movers.length === 0) return null;

  const isOnV3 = activeVintage === 2025.7;

  // Active vintage's coverage data for stat cards
  const activeCoverage = isOnV3 ? (analyticsV3?.coverage ?? analytics?.coverage) : analytics?.coverage;

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

  // Narrative
  const autoToAugCount = transitions.transitions.find((t) => t.from === "automation" && t.to === "augmentation")?.count ?? 0;
  const manualToAugCount = transitions.transitions.find((t) => t.from === "manual" && t.to === "augmentation")?.count ?? 0;

  // ── Sparkline normalisation ─────────────────────────────
  const companyMaxDelta = Math.max(...companies.map((c) => Math.max(Math.abs(c.automationDelta), Math.abs(c.augmentationDelta))), 0.001);
  const countryMaxDelta = Math.max(...countriesWithDeltas.map((c) => Math.max(Math.abs(c.automationDelta ?? 0), Math.abs(c.augmentationDelta ?? 0))), 0.001);

  // ── Company scatter data ─────────────────────────────────
  const maxHC = Math.max(...companies.map((c) => c.headcount), 1);
  const companyScatter: ScatterPoint[] = companies.map((c) => ({
    key: c.name,
    label: c.name,
    x: c.automationDelta,
    y: c.augmentationDelta,
    size: 2.5 + (c.headcount / maxHC) * 5,
    headcount: c.headcount,
    industry: c.industry,
    hqCountry: c.hqCountry,
    netAIDelta: c.netAIDelta,
  }));

  // ── Trajectory chart data ───────────────────────────────
  // Helper: total AI exposure for an industry/country metric
  const exposure = (m: { averageAutomation: number | null; averageAugmentation: number | null }) =>
    (m.averageAutomation ?? 0) + (m.averageAugmentation ?? 0);

  // Industry trajectory: v1 from v4 deltas, v3 from snapshot, endpoint based on active vintage
  const industryTrajectory: SlopeLine[] = (() => {
    const v4Industries = analytics?.industries ?? [];
    if (v4Industries.length === 0) return [];

    // v3 analytics lookup
    const v3Map = new Map(
      (analyticsV3?.industries ?? []).map((i) => [i.industry, i]),
    );

    // Only include industries with meaningful v1→v4 change
    const withDeltas = v4Industries.filter(
      (i) => i.netExposureDelta != null && i.netExposureDelta !== 0,
    );

    const result: SlopeLine[] = [];
    for (const ind of withDeltas) {
      const v4Val = exposure(ind);
      // v1 from delta (guaranteed to differ from v4)
      const v1Val = v4Val - (ind.netExposureDelta ?? 0);
      // v3 from analytics snapshot
      const v3Ind = v3Map.get(ind.industry);
      const v3Val = v3Ind ? exposure(v3Ind) : undefined;

      if (isOnV3) {
        // On v3 timeline: show v1 → v3 (2-point), skip if no v3 data
        if (v3Val == null) continue;
        result.push({ key: ind.industry, label: ind.industry, v1: v1Val, v4: v3Val });
      } else {
        // On v4 timeline: show v1 → v3 → v4 (3-point with optional midpoint)
        result.push({ key: ind.industry, label: ind.industry, v1: v1Val, v3: v3Val, v4: v4Val });
      }
    }
    return result.sort((a, b) => (b.v4 - b.v1) - (a.v4 - a.v1));
  })();

  // Country trajectory: v1 from v4 deltas, v3 from snapshot, endpoint based on active vintage
  const countryTrajectory: SlopeLine[] = (() => {
    if (countriesWithDeltas.length === 0) return [];

    // v3 analytics lookup
    const v3Map = new Map(
      (analyticsV3?.countries ?? []).map((c) => [c.country, c]),
    );

    const result: SlopeLine[] = [];
    for (const c of countriesWithDeltas) {
      if (c.averageAutomation == null || c.averageAugmentation == null) continue;
      const v4Val = exposure(c);
      // v1 from delta (guaranteed to differ from v4)
      const v1Val = v4Val - (c.netExposureDelta ?? 0);
      // v3 from analytics snapshot
      const v3C = v3Map.get(c.country);
      const v3Val = v3C ? exposure(v3C) : undefined;

      if (isOnV3) {
        // On v3 timeline: show v1 → v3 (2-point), skip if no v3 data
        if (v3Val == null) continue;
        result.push({ key: c.country, label: c.country, v1: v1Val, v4: v3Val });
      } else {
        // On v4 timeline: show v1 → v3 → v4 (3-point with optional midpoint)
        result.push({ key: c.country, label: c.country, v1: v1Val, v3: v3Val, v4: v4Val });
      }
    }
    return result.sort((a, b) => (b.v4 - b.v1) - (a.v4 - a.v1));
  })();

  // Resolve initial defaults (Legal for industry, top country by delta)
  const effectiveIndustry: string | null =
    highlightedIndustry === "__initial__"
      ? (industryTrajectory.find((l) => /legal/i.test(l.label))?.key ?? industryTrajectory[0]?.key ?? null)
      : (highlightedIndustry || null);
  const effectiveCountry: string | null =
    highlightedCountry === "__initial__"
      ? (countryTrajectory[0]?.key ?? null)
      : (highlightedCountry || null);

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,250,0.86)] px-6 py-10 shadow-[0_28px_65px_rgba(31,29,18,0.12)] backdrop-blur-md sm:px-10"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(245,78,0,0.06),_transparent_60%)]" />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[rgba(38,37,30,0.5)]">
            {isOnV3 ? "Jan 2025 → Sep 2025" : "Jan 2025 → Nov 2025"}
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
        {activeCoverage && (
          <>
            <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
                Companies
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
                {activeCoverage.companies.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(38,37,30,0.08)] bg-white/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(38,37,30,0.45)]">
                Avg AI exposure
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#26251e]">
                {activeCoverage.averageExposure.toFixed(1)}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── V1→V4 Metrics Change Table (collapsed by default) ── */}
      <div className="mt-10">
        <button
          type="button"
          onClick={() => setClassificationOpen((v) => !v)}
          className="group mb-4 flex w-full items-center gap-2 text-left"
        >
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.5)]">
            V1 → V4 task classification changes
          </h3>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-[rgba(38,37,30,0.3)] transition-colors group-hover:text-[rgba(38,37,30,0.5)]" strokeWidth={1.8} />
        </button>
        {classificationOpen && (
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
        )}
      </div>

      {/* ── Industry Trajectory ── */}
      {industryTrajectory.length > 0 && (
        <Section title={isOnV3 ? "Industry trajectory (avg AI exposure, v1 → v3)" : "Industry trajectory (avg AI exposure, v1 → v3 → v4)"}>
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Each line is one industry. Click to highlight and compare trajectories.
          </p>
          <SlopeChart
            lines={industryTrajectory}
            highlightedKey={effectiveIndustry}
            onHighlight={(k) => setHighlightedIndustry(k ?? "")}
            yLabel="Avg AI exposure"
            endLabel={isOnV3 ? "Sep 2025" : undefined}
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

      {/* ── Company Scatter ── */}
      {companyScatter.length > 0 && (
        <Section title="Company landscape (automation Δ vs augmentation Δ)">
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Each dot is one company. Size reflects headcount. Click to inspect.
          </p>
          <CompanyScatter
            points={companyScatter}
            highlightedKey={highlightedScatterCompany}
            onHighlight={setHighlightedScatterCompany}
          />
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
        <Section title={isOnV3 ? "Country trajectory (avg AI exposure, v1 → v3)" : "Country trajectory (avg AI exposure, v1 → v3 → v4)"}>
          <p className="mb-4 -mt-2 text-sm text-[rgba(38,37,30,0.55)]">
            Each line is one country. Click to highlight and compare trajectories.
          </p>
          <SlopeChart
            lines={countryTrajectory}
            highlightedKey={effectiveCountry}
            onHighlight={(k) => setHighlightedCountry(k ?? "")}
            yLabel="Avg AI exposure"
            endLabel={isOnV3 ? "Sep 2025" : undefined}
          />
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
