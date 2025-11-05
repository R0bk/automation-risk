"use client";
import React, { useState } from "react";

type RealityView = 0 | 1 | 2;

const QUESTION_1 = 'People talk "AI mass replacement" - so where is it?';
const QUESTION_2 = "If it's here, what does it mean for my role, my team, my company?";
const QUESTION_3 = "What industries and countries should I look to - who wins, who loses?";

const REALITY_AUGMENT_COLOR = "rgb(252, 146, 85)";
const REALITY_AUTOMATE_COLOR = "#cf2d56";

/* ----------------------------- Entry slide ----------------------------- */

export function RealityCheckSlide() {
  const [view, setView] = useState<RealityView>(0);
  const questions = [QUESTION_1, QUESTION_2, QUESTION_3];

  return (
    <div className="text-neutral-800">
      <div className="flex flex-col mb-6 gap-2 md:flex-row" role="tablist" aria-label="Reality check">
        {questions.map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={view === i}
            aria-controls={`reality-panel-${i}`}
            onClick={() => setView(i as RealityView)}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-700/20",
              view === i ? "bg-white shadow-sm ring-1 ring-neutral-200/80 font-medium" : "hover:bg-white/60",
            ].join(" ")}
          >
            {`Q${i + 1}: ${label}`}
          </button>
        ))}
      </div>

      <div id="reality-panel-0" hidden={view !== 0}>{view === 0 && <RealityCheckQ1 />}</div>
      <div id="reality-panel-1" hidden={view !== 1}>{view === 1 && <RealityCheckQ2 />}</div>
      <div id="reality-panel-2" hidden={view !== 2}>{view === 2 && <RealityCheckQ3 />}</div>
    </div>
  );
}

/* ------------------------------ Q1 ------------------------------ */

function RealityCheckQ1() {
  return (
    <section aria-labelledby="reality-q1">
      <h3 id="reality-q1" className="text-lg font-medium text-neutral-900 md:text-xl">
        It's not here... yet
      </h3>
      <p className="mt-1 text-[15px] text-neutral-800">
        0 roles have AI automation on every task, but does that imply 0 replacement?
      </p>
      <p className="mt-2 text-[15px] text-neutral-800">
        <b>No.</b> Replacement appears when the <b>deliverable can be obtained self‑serve</b>.
        An agent doesn't need to consult with customers if the customer can simply 
        vibe-code an output themselves, the rest of the role’s overhead stops mattering.
        
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1fr]">
        {/* What you actually see */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-lg text-neutral-900 font-medium">What we see</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              <b>Globally, a small impact so-far</b>: across ~1,000 large firms we see ~<b>20%</b> of tasks benefiting
              today under best case assumptions*.<br/>
              
            </li>
            <li>
              <b>Locally, big pockets of impact</b>: inside specialist sectors (e.g. AI), or specific teams (e.g. marketing, research, CX, IT) there's material impact with potential to automate/augment 50, 60, or even 70% of tasks today.
            </li>
          </ul>
          {/* <RealityRoleTaskBars className="mt-3" /> */}
        </div>

        {/* Why it may not look like layoffs (yet) */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-lg font-medium text-neutral-900">What's the intuition</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              If no role is fully automated, and self-serve conversions rare, what do you get? 
            </li>
            <li>
              <b>Drastic speed and quality gains</b>, but only for staff who have the depth of understanding to <b>know when AI is right or wrong</b>
            </li>
            <li>
              These are your experienced staff, you'll leverage them to do more, you won't hire juniors, and you only redraw that org chart upon self-serve.
            </li>
          </ul>
          {/* <RealityLegend className="mt-3" /> */}
        </div>
      </div>

      {/* Roles most exposed: intensity vs headcount impact */}
      {/* <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-black/5">
        <h4 className="text-[15px] font-semibold text-neutral-900">Where risk concentrates right now</h4>
        <p className="mt-1 text-[13px] text-neutral-700">
          Two kinds of risk: <b>usage‑intensity</b> (who’s already using AI a lot) and <b>headcount scale</b>
          (biggest macro impact if exposed tasks vanish or go self‑serve).
        </p>
        <RealityTopRoles className="mt-3" />
      </div> */}
      {/* Slide footnote */}
      <div className="mt-2 text-center">
        <span className="text-neutral-700 text-xs">*Assuming that you can get past compliance, regulatory gates, and have motivated staff, earnestly trying AI - it's not easy!</span>
      </div>
    </section>
  );
}

/* ------------------------------ Q2 ------------------------------ */

function RealityCheckQ2() {
  return (
    <section aria-labelledby="reality-q2">
      <h3 id="reality-q2" className="text-lg font-semibold text-neutral-900 md:text-xl">
        What it means inside companies today
      </h3>
      <p className="mt-1 text-[15px] text-neutral-800">
        The pattern is a <b>bifurcation</b>. Digital, reviewable work shows much higher task exposure than
        field‑intensive or safety‑gated work. Inside firms, <b>Tech/Data</b>, <b>CX/Ops</b>, and{" "}
        <b>Content/Marketing</b> move first; frontline physical workflows mostly see back‑office gains.
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* Role-level (no “life advice”) */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-[15px] font-semibold text-neutral-900">Role‑level effects we observe</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              <b>Editing over creating</b>: more review/curation, fewer from‑scratch steps on text/data tasks.
            </li>
            <li>
              <b>Junior task compression</b>: entry‑level task pools shrink; experienced reviewers amplify output.
            </li>
            <li>
              <b>Human gates stay</b>: sign‑off and accountable decisions remain human; prep beneath them shrinks.
            </li>
          </ul>
        </div>

        {/* Org/team shifts (insight-led) */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-[15px] font-semibold text-neutral-900">Where the change lands first</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              Digital functions (AI/Software, CX, Marketing, IT) show <b>55–80% task touch</b> in our org
              examples; physical operations trail except for back‑office steps.
            </li>
            <li>
              <b>SOPs update</b>: AI steps move into the mainline with approvals & audit trails.
            </li>
            <li>
              Spend rebalances from vendors to <b>internal templates/prompts</b> and reviewer time.
            </li>
          </ul>
          <RealityOrgExposure className="mt-3" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Q3 ------------------------------ */

function RealityCheckQ3() {
  return (
    <section aria-labelledby="reality-q3">
      <h3 id="reality-q3" className="text-lg font-semibold text-neutral-900 md:text-xl">
        Who to watch and who to deprioritize (industries & countries)
      </h3>
      <p className="mt-1 text-[15px] text-neutral-800">
        Use the leaders to borrow playbooks; treat the laggards as low‑yield near‑term. Adoption share does not
        equal value capture—compute and platform economics may accrue elsewhere.
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* Industries */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-[15px] font-semibold text-neutral-900">Industries — winners & laggards</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              <b>Winners</b>: Artificial Intelligence, Software & IT Services, Media/Internet, Professional
              Services.
            </li>
            <li>
              <b>Laggards</b>: Transportation & Logistics, Mining, Industrial Equipment/Automation, Chemicals,
              Engineering & Construction.
            </li>
          </ul>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <RealityMacroHeat kind="industry" variant="top" />
            <RealityMacroHeat kind="industry" variant="bottom" />
          </div>
        </div>

        {/* Countries */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
          <h4 className="text-[15px] font-semibold text-neutral-900">Countries — winners & laggards</h4>
          <ul className="mt-2 space-y-1.5 text-[14px] text-neutral-800">
            <li>
              <b>Winners</b>: Ireland, India, Nigeria, Israel, United Kingdom (high share of roles already using
              AI).
            </li>
            <li>
              <b>Laggards</b>: Taiwan, Mexico, New Zealand, Denmark, Indonesia (lower share today).
            </li>
            <li className="text-[13px] text-neutral-700">
              Adoption ≠ capture: much spend ultimately accrues to cloud/GPU supply chains outside some adopting
              countries.
            </li>
          </ul>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <RealityMacroHeat kind="country" variant="top" />
            <RealityMacroHeat kind="country" variant="bottom" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Shared components --------------------------- */

function RealityTopRoles({ className = "" }: { className?: string }) {
  // Usage-intensity leaders (from job-level “usage rank” view)
  const intensity: Array<[string, number]> = [
    ["Software Developers, Applications", 5.20],
    ["Data Warehousing Specialists", 5.06],
    ["Computer Programmers", 4.82],
    ["Web Developers", 3.23],
    ["Software Developers, Systems Software", 3.05],
    ["Computer Systems Analysts", 2.66],
    ["Bioinformatics Technicians", 2.65],
    ["Network & Computer Systems Administrators", 2.53],
  ];

  // High headcount tasks with exposure (from your task table)
  const headcountTasks: Array<[string, string]> = [
    ["Cashiers — answer customer questions/procedures", "≈2.3M"],
    ["Software Dev (Apps) — modify existing software", "≈2.1M"],
    ["Customer Service Reps — review policy terms", "≈1.8M"],
    ["Retail Salespersons — greet & ascertain needs", "≈1.5M"],
    ["Management Analysts — document & recommend", "≈1.39M"],
    ["Stock/Parts Clerks — advise on parts suitability", "≈1.19M"],
    ["Network & Systems Admins — diagnose & resolve", "≈1.04M"],
    ["General & Ops Managers — review financials/perf", "≈1.03M"],
  ];

  return (
    <div className={["grid gap-4 md:grid-cols-2", className].join(" ").trim()}>
      <div>
        <div className="text-[13px] font-semibold text-neutral-900">High usage‑intensity roles</div>
        <ul className="mt-2 space-y-1.5">
          {intensity.map(([label, pct]) => (
            <li key={label} className="flex items-center gap-3 text-[13px]">
              <span className="flex-1 truncate">{label}</span>
              <span className="w-28">
                <div className="h-1.5 w-full rounded bg-neutral-200">
                  <div
                    className="h-1.5 rounded"
                    style={{ width: `${Math.min(pct, 6) * 16}%`, background: REALITY_AUGMENT_COLOR }}
                  />
                </div>
              </span>
              <span className="w-10 text-right text-neutral-700">{pct.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-[12px] text-neutral-600">
          Usage ≠ potential: intensity shows “how much is used,” not “how much could be automated.”
        </div>
      </div>

      <div>
        <div className="text-[13px] font-semibold text-neutral-900">High‑headcount tasks with exposure</div>
        <ul className="mt-2 space-y-1.5">
          {headcountTasks.map(([label, hc]) => (
            <li key={label} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="flex-1 truncate">{label}</span>
              <span className="shrink-0 rounded bg-[rgba(34,28,20,0.06)] px-2 py-0.5 text-[12px] text-neutral-700">{hc}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-[12px] text-neutral-600">
          Scale matters: deleting a small step in a massive task class moves the macro needle.
        </div>
      </div>
    </div>
  );
}

function RealityRoleTaskBars({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 150" role="img" aria-label="Role to task exposure bars">
      <defs>
        <filter id="rc-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
        </filter>
      </defs>
      <g transform="translate(20,12)" filter="url(#rc-shadow)">
        <rect width="600" height="50" rx="12" fill="#ffffff" />
        <text x="20" y="32" fontSize="14" fontWeight="600" fill="#111827">Role</text>
        <rect x="120" y="22" width="380" height="8" rx="4" fill="#e5e7eb" />
        <rect x="120" y="22" width="210" height="8" rx="4" fill={REALITY_AUGMENT_COLOR} />
        <rect x="330" y="22" width="70" height="8" rx="0" fill={REALITY_AUTOMATE_COLOR} />
      </g>
      {["Task A", "Task B", "Task C"].map((task, idx) => {
        const augWidth = [200, 240, 170][idx];
        const autoWidth = [60, 40, 30][idx];
        const autoX = [320, 380, 300][idx];
        return (
          <g key={task} transform={`translate(20,${72 + idx * 24})`} filter="url(#rc-shadow)">
            <rect width="600" height="20" rx="8" fill="#ffffff" />
            <text x="12" y="14" fontSize="12" fill="#374151">{task}</text>
            <rect x="120" y="8" width="430" height="6" rx="3" fill="#e5e7eb" />
            <rect x="120" y="8" width={augWidth} height="6" rx="3" fill={REALITY_AUGMENT_COLOR} />
            <rect x={autoX} y="8" width={autoWidth} height="6" rx="0" fill={REALITY_AUTOMATE_COLOR} />
          </g>
        );
      })}
    </svg>
  );
}

function RealityLegend({ className = "" }: { className?: string }) {
  return (
    <div className={["text-xs text-neutral-600", className].join(" ").trim()}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: REALITY_AUGMENT_COLOR }} />
        <span>Augmentation</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: REALITY_AUTOMATE_COLOR }} />
        <span>Automation</span>
      </div>
    </div>
  );
}

function RealityOrgExposure({ className = "" }: { className?: string }) {
  const rows: Array<[string, number, number]> = [
    ["Technology Services", 42, 28],
    ["Data & Analytics", 48, 24],
    ["Customer Operations", 35, 20],
    ["Corporate Functions", 28, 18],
    ["Leadership", 32, 8],
  ];

  return (
    <svg className={className} viewBox="0 0 560 180" role="img" aria-label="Org exposure by team">
      {rows.map(([label, aug, auto], idx) => (
        <g key={label} transform={`translate(16,${18 + idx * 30})`}>
          <text x="0" y="14" fontSize="12" fill="#374151">{label}</text>
          <rect x="180" y="6" width="340" height="10" rx="5" fill="#e5e7eb" />
          <rect x="180" y="6" width={aug * 3} height="10" rx="5" fill={REALITY_AUGMENT_COLOR} />
          <rect x={180 + aug * 3} y="6" width={auto * 3} height="10" rx="0" fill={REALITY_AUTOMATE_COLOR} />
          <text x="540" y="14" fontSize="11" fill="#4b5563" textAnchor="end">Aug {aug}% · Auto {auto}%</text>
        </g>
      ))}
    </svg>
  );
}

function RealityMacroHeat({
  kind,
  variant = "top",
  className = "",
}: {
  kind: "industry" | "country";
  variant?: "top" | "bottom";
  className?: string;
}) {
  // Aligned to your screenshots (leaders + laggards)
  let rows: Array<[string, number]> = [];

  if (kind === "industry" && variant === "top") {
    rows = [
      ["Artificial Intelligence", 39],
      ["Software & IT Services", 34],
      ["Media Streaming", 30],
      ["Professional Services", 30],
      ["Internet Services", 30],
    ];
  }
  if (kind === "industry" && variant === "bottom") {
    rows = [
      ["Chemicals", 11],
      ["Engineering & Construction", 11],
      ["Industrial Equip. & Automation", 10],
      ["Transportation & Logistics", 7],
      ["Mining", 7],
    ];
  }
  if (kind === "country" && variant === "top") {
    rows = [
      ["Ireland", 32],
      ["India", 27],
      ["Nigeria", 25],
      ["Israel", 24],
      ["United Kingdom", 23],
    ];
  }
  if (kind === "country" && variant === "bottom") {
    rows = [
      ["Taiwan", 8],
      ["Mexico", 11],
      ["New Zealand", 13],
      ["Denmark", 13],
      ["Indonesia", 13],
    ];
  }

  return (
    <svg className={className} viewBox="0 0 560 160" role="img" aria-label={`${kind} exposure bars (${variant})`}>
      {rows.map(([label, pct], idx) => (
        <g key={label} transform={`translate(16,${18 + idx * 26})`}>
          <text x="0" y="14" fontSize="12" fill="#374151">{label}</text>
          <rect x="180" y="6" width="340" height="10" rx="5" fill="#e5e7eb" />
          <rect x="180" y="6" width={pct * 3} height="10" rx="5" fill={REALITY_AUGMENT_COLOR} />
          <text x="540" y="14" fontSize="11" fill="#4b5563" textAnchor="end">{pct}%</text>
        </g>
      ))}
    </svg>
  );
}
