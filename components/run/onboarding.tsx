"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Drop-in modal for "Help me understand" onboarding.
 * - Carousel/clicker interface for step-by-step learning
 * - ESC to close, focus trapped, click backdrop to close
 * - Persona-aware microcopy
 * - Keyboard navigation with arrow keys
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   companyName?: string
 *   defaults?: {
 *     automation?: number;   // 0..1
 *     augmentation?: number; // 0..1
 *     manual?: number;       // 0..1 (derived if not provided)
 *     persona?: Persona;
 *   }
 */
type Persona = "HR" | "Worker" | "Policy" | "Research" | "Exec";

interface Props {
  open: boolean;
  onClose: () => void;
  companyName?: string;
  defaults?: {
    automation?: number;
    augmentation?: number;
    manual?: number;
    persona?: Persona;
  };
}

export default function HelpMeUnderstandModal({
  open,
  onClose,
  companyName: _companyName = "your company",
  defaults,
}: Props) {
  const [persona, setPersona] = useState<Persona>(defaults?.persona ?? "HR");
  const [expanded, setExpanded] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const titleId = "hmu-title";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Slide configuration
  const slides = [
    { title: "Three Questions", subtitle: "What started this project" },
    { title: "Breaking It Down", subtitle: "Understanding workforce composition" },
    { title: "Roles to Tasks", subtitle: "Breaking down daily work" },
    { title: "AI Detection", subtitle: "Checking for AI usage" },
    { title: "Task Classification", subtitle: "Automation vs augmentation" },
    { title: "Role Impact", subtitle: "Overview of impact on roles" },
    { title: "Org Research", subtitle: "Estimating structure bottom up" },
    { title: "Economy View", subtitle: "Benchmarking across industries" },
    { title: "How We Model", subtitle: "From tasks to roles to departments" },
    { title: "Organizational View", subtitle: "Applying insights across your company" },
    { title: "Take Action", subtitle: "Persona-specific recommendations" },
  ];
  const totalSlides = slides.length;

  // Navigation handlers
  const goToNextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)));
  }, [totalSlides]);

  // Reset to first slide when modal opens
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  // Manage open/close side-effects and keyboard navigation
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    // Focus first focusable within dialog
    const t = setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        trapFocus(e, dialogRef.current);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevSlide();
      }
    };

    document.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, goToNextSlide, goToPrevSlide]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      aria-labelledby={titleId}
      aria-modal="true"
      role="dialog"
      onMouseDown={(e) => {
        // click backdrop to close
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        background:
          "linear-gradient(155deg, rgba(20,18,14,0.55), rgba(20,18,14,0.55))",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-3xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] outline-none"
        style={{
          background:
            "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
          border: "1px solid rgba(34,28,20,0.10)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 border-b border-neutral-200/50 pb-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-neutral-900">
              Help me understand
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200/60 focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Progress Indicators */}
        <div className="px-6 pt-0 -mt-12 pb-2">
          {/* <div className="text-center mb-3"> */}
            {/* <h3 className="text-base font-semibold text-neutral-900">{slides[currentSlide].title}</h3> */}
            {/* <p className="text-xs text-neutral-600 mt-1">{slides[currentSlide].subtitle}</p> */}
          {/* </div> */}
          <div className="flex items-center justify-center gap-2">
            {slides.map((slide, i) => (
              <div key={i} className="group relative">
                <button
                  onClick={() => goToSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide
                      ? "w-8 bg-neutral-900"
                      : "w-2 bg-neutral-300 hover:bg-neutral-400"
                  }`}
                  aria-label={`Go to ${slide.title}`}
                />
                {/* Tooltip on hover */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {slide.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body - Carousel Content */}
        <div className="px-6 pb-4 overflow-hidden min-h-[400px] md:min-h-[480px]">
          <div
            className="transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            <div className="flex min-h-[380px] md:min-h-[460px]">
              {/* Slide 1: Three Questions */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Three questions" className="flex items-center justify-center min-h-[380px] md:min-h-[460px] h-full">
                  <div>
                    <h3 className="mb-6 text-2xl font-semibold text-center text-neutral-800">
                      Let me ask you
                    </h3>
                    <div className="space-y-4 max-w-4xl mx-auto">
                      <HookCard title="Where is this AI great replacement? Because I haven't seen it yet." />
                      <HookCard title="And if it's here, what companies, teams, or roles are at risk?" />
                      <HookCard title="So what does that mean for countries, industries? Who wins, who loses?" />
                    </div>
                    <h3 className="mt-12 text-xl font-medium text-center text-neutral-800">
                      Let's explore some early answers
                    </h3>
                  </div>
                </section>
              </div>

              {/* Slide 2: Breaking It Down */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Breaking down workforce" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl">
                    <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800">
                      To figure these out, we first break down a workforce into roles
                    </h3>
                    <div className="w-full overflow-hidden rounded-xl p-4" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}>
                      <WorkforceBreakdownDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 3: Roles to Tasks */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Breaking down roles to tasks" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl">
                    <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800">
                      And then roles into tasks
                    </h3>
                    <div className="w-full overflow-hidden rounded-xl p-4" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}>
                      <RoleToTasksDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 4: AI Detection */}
              <div className="w-full flex-shrink-0 px-1">
                    <section aria-label="AI usage detection" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl">
                    <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800">
                      Which lets us identify if{" "}
                      <DefinitionHover
                        accent="#6366f1"
                        title="Anthropic Economic Index Corpus"
                        description="We ground usage estimates in Anthropic’s 1M+ AI chat conversations, each aligned to an O*NET task, so we see how copilots are actually applied."
                        bullets={[
                          "Coverage: 1,000,000+ de-identified Anthropic chat transcripts mapped to task IDs.",
                          "Granularity: task frequencies roll up to roles, departments, and industries without guesswork.",
                        ]}
                      >
                        AI
                      </DefinitionHover>{" "}
                      is being used for those tasks
                    </h3>
                    <div className="w-full overflow-hidden rounded-xl p-4" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}>
                      <AIUsageDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 5: Task Classification + Definitions */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Task classification" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl space-y-5">
                    <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800">
                      And classify if AI is{" "}
                      <DefinitionHover
                        accent="rgb(252, 146, 85)"
                        title="Augmentation"
                        description="Augmentation focuses on collaborative interaction patterns"
                        bullets={[
                          "Learning: Users ask Claude for information or explanations about various topics",
                          "Task Iteration: Users iterate on tasks collaboratively with Claude",
                          "Validation: Users validate the accuracy of Claude's responses",
                        ]}
                      >
                        Augmenting
                      </DefinitionHover>{" "}
                      or{" "}
                      <DefinitionHover
                        accent="#cf2d56"
                        title="Automation"
                        description="Automation encompasses interaction patterns focused on task completion."
                        bullets={[
                          "Directive: Users give Claude a task and it completes it with minimal back-and-forth",
                          "Feedback Loops: Users automate tasks and provide feedback to Claude as needed",
                        ]}
                      >
                        Automating
                      </DefinitionHover>{" "}
                      those tasks
                    </h3>
                    <div className="w-full overflow-hidden rounded-xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}>
                      <TaskClassificationDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 6: Role Impact */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Role impact" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl">
                    <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800">
                      This gives us an overview of the impact on any role
                    </h3>
                    <div className="w-full overflow-hidden rounded-xl p-4" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}>
                      <RoleImpactDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 7: Org Research */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Org research and headcount estimation" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl space-y-5">
                    <h3 className="text-2xl font-semibold text-center text-neutral-800">
                      Which we project onto teams and companies; by using AI to{" "}
                      <DefinitionHover
                        accent="rgb(34, 28, 20)"
                        title="Research and Estimate"
                        description="We task AI with stitching public filings, job boards, and social graphs to infer teams and reporting lines. That lets us map automation and augmentation exposure to real org units-bottom up, function by function, and across peer companies."
                        bullets={[]}
                      >
                        research and estimate
                      </DefinitionHover>{" "}
                      org charts with headcounts
                    </h3>
                    <div
                      className="w-full overflow-hidden rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
                    >
                      <OrgResearchDiagram />
                    </div>
                  </div>
                </section>
              </div>

              {/* Slide 8: From Org to Economy */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Org to economy benchmarking" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl space-y-5">
                    <h3 className="text-2xl font-semibold text-center text-neutral-800">
                      Then we benchmark exposure across peers, sectors, and countries
                    </h3>
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
                    >
                      <MiniFlow />
                      <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-neutral-800">
                        <TinyStat label="Peer benchmarking" value="350+ firms" hint="public runs & research set" />
                        <TinyStat label="Sector rollups" value="NAICS taxonomy" hint="industry comparisons" />
                        <TinyStat label="Country slices" value="by headcount" hint="policy targeting" />
                      </div>
                    </div>
                    <p className="mx-auto max-w-3xl text-center text-sm text-neutral-700">
                      Exposure scores stay tied back to the task evidence beneath them, so regulators, unions, and executives can audit the chain from company to county.
                    </p>
                  </div>
                </section>
              </div>

              {/* Slide 9: How We Model Work */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Workforce model" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl space-y-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-800">
                    How we model work
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <p className="text-sm text-neutral-800">
                        We map <b>Role → Tasks</b> using the O*NET catalog. Each task gets an exposure label:
                        <i> automation</i>, <i>augmentation</i>, or <i>manual</i>. Then we roll up.
                      </p>
                      <MiniTree />
                      <CodeNote
                        lines={[
                          "exposure(role) = Σ task_share * exposure(task)",
                          "dept_score = size‑weighted mean(role_scores)",
                        ]}
                      />
                    </Card>
                    <Card>
                      <p className="text-sm text-neutral-800">
                        Missing data doesn't break reports. We degrade gracefully and show uncertainty bands.
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                        <li>• Transparent assumptions, linked sources</li>
                        <li>• Reproducible runs (immutable transcripts)</li>
                        <li>• Public by default for audit & research</li>
                      </ul>
                      <WhyTrustThis />
                    </Card>
                  </div>
                  </div>
                </section>
              </div>

              {/* Slide 10: Organizational Application */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Organizational application" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4 h-full">
                  <div className="w-full max-w-5xl space-y-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-800">
                      Apply it to the org chart
                    </h3>
                    <Card>
                      <p className="text-sm text-neutral-800">
                        We project task exposure onto departments and roles. Bars show automation (red), augmentation (orange), and manual (neutral).
                      </p>
                      <MiniOrg />
                      <p className="mt-2 text-xs text-neutral-600">
                        Toggle depth in the main app (level 1–4) for different levels of detail.
                      </p>
                    </Card>
                  </div>
                </section>
              </div>

              {/* Slide 11: Take Action */}
              <div className="w-full flex-shrink-0 px-1">
                <section aria-label="Next steps" className="flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] py-4">
                  <div className="w-full max-w-md space-y-5">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-800">
                        What should I do this quarter?
                      </h3>
                      <PersonaCTAs persona={persona} />
                    </div>

                    <details
                      className="rounded-lg border border-neutral-300/60 bg-white/70 p-3 text-sm text-neutral-800"
                      open={expanded}
                      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
                    >
                      <summary className="cursor-pointer select-none text-sm font-medium">
                        {expanded ? "Hide the deeper explanation" : "Show the deeper explanation"}
                      </summary>
                      <div className="mt-2 space-y-2">
                        <p>
                          We stream analysis as it happens (SSE). A small "think" step reduces redundant web calls and cost.
                          The O*NET catalog is embedded and cached, so lookups are fast and reproducible.
                        </p>
                        <p className="text-neutral-700">
                          Scores are not pink slips. Exposure flags where to <i>retrain</i>, <i>retool</i>, or <i>reorganize</i>.
                          We ship full citations and an audit trail so unions, HR, researchers, and policymakers can interrogate the data.
                        </p>
                      </div>
                    </details>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2 border-t border-neutral-200/50">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlide === 0}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              currentSlide === 0
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-neutral-200/60"
            } focus:outline-none focus:ring-2 focus:ring-black/20`}
            aria-label="Previous slide"
          >
            ← Previous
          </button>

          <div className="text-sm text-neutral-600">
            Press <kbd className="px-1.5 py-0.5 text-xs rounded border border-neutral-300 bg-white">←</kbd> or <kbd className="px-1.5 py-0.5 text-xs rounded border border-neutral-300 bg-white">→</kbd> to navigate
          </div>

          <button
            onClick={goToNextSlide}
            disabled={currentSlide === totalSlides - 1}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              currentSlide === totalSlides - 1
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-neutral-200/60"
            } focus:outline-none focus:ring-2 focus:ring-black/20`}
            aria-label="Next slide"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function WorkforceBreakdownDiagram() {
  return (
    <svg viewBox="0 0 1400 380" className="w-full h-auto max-w-4xl mx-auto">
      {/* Main workforce container */}
      <rect
        x="10"
        y="60"
        width="1380"
        height="310"
        rx="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-400"
      />

      {/* Workforce label */}
      <text
        x="700"
        y="130"
        fontSize="32"
        fill="currentColor"
        textAnchor="middle"
        className="font-semibold text-neutral-900"
      >
        Workforce
      </text>

      {/* Role boxes */}
      <g className="text-neutral-700">
        {/* Role 1 */}
        <rect
          x="120"
          y="200"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="240"
          y="270"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Role
        </text>

        {/* Role 2 */}
        <rect
          x="440"
          y="200"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="560"
          y="270"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Role
        </text>

        {/* Role 3 */}
        <rect
          x="760"
          y="200"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="880"
          y="270"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Role
        </text>

        {/* Role 4 */}
        <rect
          x="1080"
          y="200"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="1200"
          y="270"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Role
        </text>
      </g>

    </svg>
  );
}

function RoleToTasksDiagram() {
  return (
    <svg viewBox="0 0 960 400" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="role-to-task-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Role box at top */}
      <rect
        x="360"
        y="40"
        width="240"
        height="120"
        rx="12"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-700"
      />
      <text
        x="480"
        y="110"
        fontSize="24"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        Role
      </text>

      {/* Arrows */}
      <g className="text-neutral-400">
        {/* Left arrow */}
        <line
          x1="420"
          y1="160"
          x2="180"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />

        {/* Center arrow */}
        <line
          x1="480"
          y1="160"
          x2="480"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />

        {/* Right arrow */}
        <line
          x1="540"
          y1="160"
          x2="780"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />
      </g>

      {/* Task boxes at bottom */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="60"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="180"
          y="310"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 */}
        <rect
          x="360"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="480"
          y="310"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 */}
        <rect
          x="660"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="780"
          y="310"
          fontSize="24"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>
    </svg>
  );
}

function AIUsageDiagram() {
  return (
    <svg viewBox="0 0 800 520" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="ai-usage-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Chat AI box at top */}
      <rect
        x="280"
        y="20"
        width="240"
        height="100"
        rx="12"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-700"
      />
      <text
        x="400"
        y="72"
        fontSize="24"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        Chat AI
      </text>
      <text
        x="400"
        y="104"
        fontSize="14"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-600"
      >
        (e.g. Claude, ChatGPT)
      </text>

      {/* Left side - Chat boxes */}
      <g className="text-neutral-700">
        {/* Chat 1 */}
        <rect
          x="60"
          y="180"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="160"
          y="230"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 2 */}
        <rect
          x="60"
          y="300"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="160"
          y="350"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 3 */}
        <rect
          x="60"
          y="420"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="160"
          y="470"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>
      </g>

      {/* Right side - Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="540"
          y="180"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="640"
          y="230"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 */}
        <rect
          x="540"
          y="300"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="640"
          y="350"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 */}
        <rect
          x="540"
          y="420"
          width="200"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="640"
          y="470"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Arrows from Chat AI to Chats */}
      <g className="text-neutral-400">
        <line
          x1="340"
          y1="120"
          x2="200"
          y2="180"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
      </g>

      {/* Arrows from Chats to Tasks */}
      <g className="text-neutral-400">
        {/* Chat 1 to Task 1 */}
        <line
          x1="260"
          y1="220"
          x2="540"
          y2="220"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="210"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 2 to Task 2 */}
        <line
          x1="260"
          y1="340"
          x2="540"
          y2="340"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="330"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 3 to Task 3 */}
        <line
          x1="260"
          y1="460"
          x2="540"
          y2="460"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="450"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>
      </g>
    </svg>
  );
}

function RoleImpactDiagram() {
  return (
    <svg viewBox="0 0 800 350" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="role-impact-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Role box with integrated task mix bar */}
      <rect
        x="270"
        y="30"
        width="260"
        height="160"
        rx="12"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-700"
      />
      <text
        x="400"
        y="70"
        fontSize="22"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700 font-medium"
      >
        Role
      </text>
      <text
        x="400"
        y="100"
        fontSize="18"
        fill="#cf2d56"
        textAnchor="middle"
      >
        15% Automated
      </text>
      <text
        x="400"
        y="125"
        fontSize="18"
        fill="rgb(252, 146, 85)"
        textAnchor="middle"
      >
        30% Augmented
      </text>

      {/* Task mix bar inside Role box */}
      <g>
        {/* Bar background */}
        <rect
          x="290"
          y="150"
          width="220"
          height="20"
          rx="4"
          fill="white"
          stroke="rgba(34,28,20,0.2)"
          strokeWidth="1"
        />

        {/* Automation segment (15%) */}
        <rect
          x="290"
          y="150"
          width="33"
          height="20"
          rx="4"
          fill="#cf2d56"
        />

        {/* Augmentation segment (30%) */}
        <rect
          x="323"
          y="150"
          width="66"
          height="20"
          fill="rgb(252, 146, 85)"
        />

        {/* Manual segment (55%) */}
        <rect
          x="389"
          y="150"
          width="121"
          height="20"
          fill="rgba(34,28,20,0.15)"
        />
      </g>

      {/* Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 - left */}
        <rect
          x="80"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="160"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 - center */}
        <rect
          x="320"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="400"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 - right */}
        <rect
          x="560"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="640"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Arrows from tasks to role */}
      <g className="text-neutral-400">
        {/* Left arrow */}
        <line
          x1="180"
          y1="220"
          x2="340"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />

        {/* Center arrow */}
        <line
          x1="400"
          y1="220"
          x2="400"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />

        {/* Right arrow */}
        <line
          x1="620"
          y1="220"
          x2="460"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />
      </g>
    </svg>
  );
}

function OrgResearchDiagram() {
  const teams = [
    { x: 110, title: "Platform Eng", headcount: "~160", automation: 0.28, augmentation: 0.47 },
    { x: 230, title: "Applied AI", headcount: "~130", automation: 0.18, augmentation: 0.62 },
    { x: 350, title: "Design Ops", headcount: "~130", automation: 0.12, augmentation: 0.51 },
    { x: 490, title: "Customer Support", headcount: "~190", automation: 0.42, augmentation: 0.38 },
    { x: 650, title: "Field Ops", headcount: "~110", automation: 0.35, augmentation: 0.33 },
    { x: 810, title: "Compliance", headcount: "~60", automation: 0.15, augmentation: 0.41 },
  ];

  return (
    <svg viewBox="0 0 1040 460" className="w-full h-auto max-w-5xl mx-auto">
      <rect
        x="36"
        y="36"
        width="968"
        height="388"
        rx="18"
        fill="none"
        stroke="rgba(34,28,20,0.08)"
        strokeDasharray="12 12"
      />

      <rect
        x="380"
        y="58"
        width="200"
        height="92"
        rx="14"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.18)"
        strokeWidth="2"
      />
      <text x="480" y="93" textAnchor="middle" fontSize="20" fontWeight="600" fill="#111827">
        Company
      </text>
      <text x="480" y="117" textAnchor="middle" fontSize="13" fill="#6b7280">
        Headcount inferred: 1,150
      </text>
      <text x="480" y="136" textAnchor="middle" fontSize="11" fill="#9ca3af">
        10-K • LinkedIn • hiring feeds
      </text>

      <line x1="480" y1="150" x2="260" y2="210" stroke="rgba(34,28,20,0.3)" strokeWidth="2" />
      <line x1="480" y1="150" x2="700" y2="210" stroke="rgba(34,28,20,0.3)" strokeWidth="2" />

      <rect
        x="180"
        y="210"
        width="160"
        height="82"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.18)"
        strokeWidth="2"
      />
      <text x="260" y="242" textAnchor="middle" fontSize="16" fontWeight="600" fill="#111827">
        Product Org
      </text>
      <text x="260" y="264" textAnchor="middle" fontSize="12" fill="#6b7280">
        ~420 roles
      </text>

      <rect
        x="620"
        y="210"
        width="160"
        height="82"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.18)"
        strokeWidth="2"
      />
      <text x="700" y="242" textAnchor="middle" fontSize="16" fontWeight="600" fill="#111827">
        Operations
      </text>
      <text x="700" y="264" textAnchor="middle" fontSize="12" fill="#6b7280">
        ~360 roles
      </text>

      <line x1="260" y1="292" x2="190" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="260" y1="292" x2="310" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="260" y1="292" x2="430" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="570" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="730" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="890" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />

      {teams.map((team, idx) => {
        const total = 140;
        const automation = Math.round(total * team.automation);
        const augmentation = Math.round(total * team.augmentation);
        const manual = Math.max(0, total - automation - augmentation);
        return (
          <g key={idx}>
            <rect
              x={team.x}
              y={340}
              width={160}
              height={80}
              rx="12"
              fill="#ffffff"
              stroke="rgba(34,28,20,0.18)"
              strokeWidth="2"
            />
            <text x={team.x + 80} y={366} textAnchor="middle" fontSize="14" fontWeight="600" fill="#111827">
              {team.title}
            </text>
            <text x={team.x + 80} y={384} textAnchor="middle" fontSize="11" fill="#6b7280">
              {team.headcount}
            </text>
            <rect
              x={team.x + 10}
              y={392}
              width={140}
              height={18}
              rx="6"
              fill="rgba(34,28,20,0.08)"
            />
            <rect x={team.x + 10} y={392} width={automation} height={18} rx="6" fill="#cf2d56" />
            <rect
              x={team.x + 10 + automation}
              y={392}
              width={augmentation}
              height={18}
              fill="rgb(252, 146, 85)"
            />
            <rect
              x={team.x + 10 + automation + augmentation}
              y={392}
              width={manual}
              height={18}
              fill="rgba(34,28,20,0.18)"
            />
            <text x={team.x + 80} y={414} textAnchor="middle" fontSize="10" fill="#6b7280">
              automation / augmentation / manual
            </text>
          </g>
        );
      })}

      <g>
        <rect x="70" y="86" width="12" height="12" rx="3" fill="#cf2d56" />
        <text x="90" y="96" fontSize="11" fill="#374151">
          Automation exposure
        </text>
        <rect x="70" y="106" width="12" height="12" rx="3" fill="rgb(252, 146, 85)" />
        <text x="90" y="116" fontSize="11" fill="#374151">
          Augmentation exposure
        </text>
        <rect x="70" y="126" width="12" height="12" rx="3" fill="rgba(34,28,20,0.25)" />
        <text x="90" y="136" fontSize="11" fill="#374151">
          Manual / unscored
        </text>
      </g>
    </svg>
  );
}

function TaskClassificationDiagram() {
  return (
    <svg viewBox="0 0 1100 500" className="w-full h-auto max-w-5xl mx-auto">
      <defs>
        <marker
          id="task-class-neutral"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
        <marker
          id="task-class-automation"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#cf2d56" />
        </marker>
        <marker
          id="task-class-augmentation"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="rgb(252, 146, 85)" />
        </marker>
      </defs>

      {/* Chat AI box */}
      <rect
        x="120"
        y="30"
        width="180"
        height="80"
        rx="12"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-700"
      />
      <text
        x="210"
        y="72"
        fontSize="20"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        Chat AI
      </text>
      <text
        x="210"
        y="100"
        fontSize="12"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-600"
      >
        (e.g. Claude, ChatGPT)
      </text>

      {/* Chat boxes */}
      <g className="text-neutral-700">
        {/* Chat 1 */}
        <rect
          x="40"
          y="160"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="110"
          y="197"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 2 */}
        <rect
          x="40"
          y="250"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="110"
          y="287"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 3 */}
        <rect
          x="40"
          y="340"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="110"
          y="377"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>
      </g>

      {/* Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="350"
          y="160"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="420"
          y="197"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 */}
        <rect
          x="350"
          y="250"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="420"
          y="287"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 */}
        <rect
          x="350"
          y="340"
          width="140"
          height="60"
          rx="12"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="420"
          y="377"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Classification boxes */}
      <g>
        {/* Automation box */}
        <rect
          x="700"
          y="160"
          width="180"
          height="80"
          rx="12"
          fill="white"
          stroke="#cf2d56"
          strokeWidth="2"
        />
        <text
          x="790"
          y="210"
          fontSize="20"
          fill="#cf2d56"
          textAnchor="middle"
          className="font-medium"
        >
          Automation
        </text>

        {/* Augmentation box */}
        <rect
          x="700"
          y="300"
          width="180"
          height="80"
          rx="12"
          fill="white"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
        />
        <text
          x="790"
          y="350"
          fontSize="20"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
          className="font-medium"
        >
          Augmentation
        </text>
      </g>

      {/* Arrows from Chat AI to Chats */}
      <g className="text-neutral-400">
        <line
          x1="180"
          y1="110"
          x2="120"
          y2="160"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
      </g>

      {/* Arrows from Chats to Tasks with "Related to" labels */}
      <g className="text-neutral-400">
        {/* Chat 1 to Task 1 */}
        <line
          x1="180"
          y1="190"
          x2="350"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="180"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 2 to Task 2 */}
        <line
          x1="180"
          y1="280"
          x2="350"
          y2="280"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="270"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 3 to Task 3 */}
        <line
          x1="180"
          y1="370"
          x2="350"
          y2="370"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="360"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>
      </g>

      {/* Arrows from Tasks to Classification with "Classify" labels */}
      <g>
        {/* Task 1 to Automation */}
        <line
          x1="490"
          y1="190"
          x2="700"
          y2="200"
          stroke="#cf2d56"
          strokeWidth="2"
          markerEnd="url(#task-class-automation)"
        />
        <text
          x="595"
          y="185"
          fontSize="12"
          fill="#cf2d56"
          textAnchor="middle"
        >
          Classify
        </text>

        {/* Task 2 to Augmentation */}
        <line
          x1="490"
          y1="280"
          x2="700"
          y2="330"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
          markerEnd="url(#task-class-augmentation)"
        />
        <text
          x="595"
          y="300"
          fontSize="12"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
        >
          Classify
        </text>

        {/* Task 3 to Augmentation */}
        <line
          x1="490"
          y1="370"
          x2="700"
          y2="350"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
          markerEnd="url(#task-class-augmentation)"
        />
        <text
          x="595"
          y="365"
          fontSize="12"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
        >
          Classify
        </text>
      </g>
    </svg>
  );
}

function HookCard({ title }: { title: string }) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:shadow-lg"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.75))",
        border: "1px solid rgba(34,28,20,0.08)",
      }}
    >
      <p className="text-base font-semibold text-neutral-900 mb-2">{title}</p>
    </div>
  );
}

function DefinitionHover({
  accent,
  title,
  description,
  bullets,
  children,
}: {
  accent: string;
  title: string;
  description: string;
  bullets: string[];
  children: React.ReactNode;
}) {
  return (
    <span
      tabIndex={0}
      aria-label={`${title} definition`}
      className="group relative inline-flex cursor-help items-center font-bold leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-500"
      style={{ color: accent }}
    >
      <span className="underline decoration-dotted decoration-2 underline-offset-4">{children}</span>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-[1100] hidden w-max -translate-x-1/2 pt-4 opacity-0 transition-all duration-150 ease-out group-hover:block group-hover:translate-y-1 group-hover:opacity-100 group-focus-visible:block group-focus-visible:translate-y-1 group-focus-visible:opacity-100"
      >
        <span
          className="pointer-events-auto relative flex max-w-xs flex-col gap-2 rounded-2xl border border-neutral-200/80 bg-white/95 p-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.2)] ring-1 ring-black/5"
        >
          <span
            className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-neutral-200/80 bg-white/95"
            aria-hidden="true"
          />
          <span className="block text-sm font-semibold text-neutral-900">{title}</span>
          <span className="block text-sm font-normal text-neutral-700">{description}</span>
          <ul className="mt-1 space-y-1 text-sm font-normal text-neutral-700">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="flex gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span className="flex-1">{bullet}</span>
              </li>
            ))}
          </ul>
        </span>
      </span>
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(34,28,20,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function CodeNote({ lines }: { lines: string[] }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-300/60 bg-neutral-800 px-3 py-2 text-xs text-neutral-100">
      {lines.join("\n")}
    </pre>
  );
}


function MiniTree() {
  // Simple role → tasks diagram
  return (
    <svg
      viewBox="0 0 520 130"
      className="mt-3 h-28 w-full"
      aria-label="Role to tasks tree"
    >
      <rect x="10" y="20" rx="8" ry="8" width="160" height="32" fill="#ffffff" stroke="rgba(34,28,20,0.25)" />
      <text x="20" y="40" fontSize="12" fill="#1f2937">Role: Data Analyst</text>

      {[
        { x: 230, label: "Clean data", color: "rgb(252, 146, 85)" }, // augmentation
        { x: 360, label: "Generate report", color: "#cf2d56" }, // automation
        { x: 230, y: 82, label: "Stakeholder review", color: "rgba(34,28,20,0.3)" }, // manual
      ].map((t, i) => (
        <g key={i}>
          <line
            x1={170}
            y1={36}
            x2={t.x - 8}
            y2={t.y ? t.y : 36}
            stroke="rgba(34,28,20,0.35)"
          />
          <rect
            x={t.x}
            y={t.y ? t.y - 14 : 20}
            rx="8"
            ry="8"
            width="130"
            height="28"
            fill="#ffffff"
            stroke="rgba(34,28,20,0.25)"
          />
          <circle cx={t.x + 10} cy={t.y ? t.y : 34} r="4" fill={t.color} />
          <text x={t.x + 20} y={(t.y ? t.y : 34) + 4} fontSize="11" fill="#1f2937">
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MiniOrg() {
  // Tiny org with bars per node
  const nodes = [
    { x: 10, y: 10, label: "Finance", a: 0.35, g: 0.45, m: 0.20 },
    { x: 10, y: 70, label: "Ops", a: 0.50, g: 0.30, m: 0.20 },
    { x: 260, y: 40, label: "Analytics", a: 0.25, g: 0.60, m: 0.15 },
  ];
  return (
    <svg viewBox="0 0 520 120" className="mt-3 h-28 w-full" aria-label="Mini org chart">
      {/* Edges */}
      <path d="M150 26 L240 50" stroke="rgba(34,28,20,0.3)" />
      <path d="M150 86 L240 60" stroke="rgba(34,28,20,0.3)" />
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="200" height="48" rx="10" ry="10" fill="#ffffff" stroke="rgba(34,28,20,0.25)" />
          <text x="12" y="18" fontSize="12" fill="#111827">{n.label}</text>
          <g transform="translate(12,24)">
            <rect width="176" height="12" fill="none" stroke="rgba(34,28,20,0.2)" rx="6" ry="6" />
            <rect width={176 * n.a} height="12" fill="#cf2d56" rx="6" ry="6" />
            <rect x={176 * n.a} width={176 * n.g} height="12" fill="rgb(252, 146, 85)" />
          </g>
          <text x="190" y="18" textAnchor="end" fontSize="10" fill="#4b5563">
            A {pct(n.a)} · G {pct(n.g)} · M {pct(n.m)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MiniFlow() {
  // Org -> Industry -> Country flow
  return (
    <svg viewBox="0 0 560 100" className="mt-1 h-24 w-full" aria-label="Aggregation flow">
      {[
        { x: 20, label: "Org" },
        { x: 220, label: "Industry" },
        { x: 420, label: "Country" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={22} width="120" height="56" rx="12" ry="12" fill="#ffffff" stroke="rgba(34,28,20,0.25)" />
          <text x={b.x + 60} y={50} textAnchor="middle" fontSize="13" fill="#111827" fontWeight={600}>
            {b.label}
          </text>
          <Segment x={b.x + 12} y={58} w={96} a={0.3 + i * 0.05} g={0.5 - i * 0.05} />
        </g>
      ))}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="rgba(34,28,20,0.35)" />
        </marker>
      </defs>
      <line x1="140" y1="50" x2="220" y2="50" stroke="rgba(34,28,20,0.35)" markerEnd="url(#arrow)" />
      <line x1="340" y1="50" x2="420" y2="50" stroke="rgba(34,28,20,0.35)" markerEnd="url(#arrow)" />
    </svg>
  );
}

function Segment({ x, y, w, a, g }: { x: number; y: number; w: number; a: number; g: number }) {
  const A = Math.round(w * a);
  const G = Math.round(w * g);
  return (
    <g>
      <rect x={x} y={y} width={w} height="8" fill="rgba(34,28,20,0.12)" rx="4" ry="4" />
      <rect x={x} y={y} width={A} height="8" fill="#cf2d56" rx="4" ry="4" />
      <rect x={x + A} y={y} width={G} height="8" fill="rgb(252, 146, 85)" />
    </g>
  );
}

function TinyStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-300/60 bg-white/70 p-2">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
      {hint && <div className="text-xs text-neutral-600">{hint}</div>}
    </div>
  );
}

function WhyTrustThis() {
  return (
    <div className="mt-3 rounded-lg border border-neutral-300/60 bg-white/70 p-2 text-xs text-neutral-700">
      <div className="font-medium text-neutral-800">Why trust this?</div>
      <ul className="mt-1 space-y-1">
        <li>• Streaming analysis with an explicit reasoning step (less redundant search)</li>
        <li>• O*NET embedded + cached for reproducibility</li>
        <li>• Immutable transcripts and public citations for audit</li>
      </ul>
    </div>
  );
}

function PersonaCTAs({ persona }: { persona: Persona }) {
  const copy: Record<Persona, { title: string; actions: string[] }> = {
    HR: {
      title: "HR: move first, not fast.",
      actions: [
        "Flag top 5 roles by exposure; align with headcount.",
        "Co-design upskilling plans where augmentation dominates.",
        "Draft redeployment paths where automation is concentrated.",
      ],
    },
    Worker: {
      title: "Worker: tilt toward tools, not toil.",
      actions: [
        "Find tasks in your role labeled ‘augmentation’. Lean in.",
        "Volunteer for workflows where copilots already help.",
        "Ask for training budget tied to measurable time saved.",
      ],
    },
    Policy: {
      title: "Policy: target, don’t spray.",
      actions: [
        "Identify counties with clustered high‑exposure roles.",
        "Fund training where augmentation > automation.",
        "Tie incentives to transparent, audited exposure data.",
      ],
    },
    Research: {
      title: "Research: measure, compare, replicate.",
      actions: [
        "Use coverage vs usage to bound results.",
        "Publish uncertainty bands and source trails.",
        "Benchmark 350+ firms by NAICS sector and country.",
      ],
    },
    Exec: {
      title: "Exec: de‑risk the reorg.",
      actions: [
        "Sequence changes: augment first, automate second.",
        "Protect critical judgment paths; automate the glue work.",
        "Report plan: upskill, redeploy, negotiate—by department.",
      ],
    },
  };

  const c = copy[persona];
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(34,28,20,0.08)" }}
    >
      <p className="text-sm font-semibold text-neutral-900">{c.title}</p>
      <ul className="mt-2 space-y-1 text-sm text-neutral-800">
        {c.actions.map((a, i) => (
          <li key={i}>• {a}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-600">
        Note: “exposure” ≠ “job loss”. It’s a planning signal to focus training, tooling, and transitions.
      </p>
    </div>
  );
}

/* ---------- Helpers ---------- */

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const focusables = root.querySelectorAll<HTMLElement>(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled"));
  if (list.length === 0) return;

  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement as HTMLElement;

  if (!e.shiftKey && active === last) {
    first.focus();
    e.preventDefault();
  } else if (e.shiftKey && active === first) {
    last.focus();
    e.preventDefault();
  }
}

export const Onboarding = () => {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOnboardingOpen(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-white">
        Tell me more
      </button>
      <HelpMeUnderstandModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        companyName="Acme Corp"
        defaults={{ automation: 0.30, augmentation: 0.55, persona: "HR" }}
      />
    </>
  );
}
