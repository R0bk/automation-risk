"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  WorkforceBreakdownDiagram,
  RoleToTasksDiagram,
  AIUsageDiagram,
  TaskClassificationDiagram,
  RoleImpactDiagram,
  OrgResearchDiagram,
  MiniFlow
} from "./Diagrams";
import { RealityCheckSlide } from "./RealityCheck";
import useEmblaCarousel from "embla-carousel-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Drop-in modal for "Help me understand" onboarding.
 * - Carousel/clicker interface for step-by-step learning
 * - ESC to close, focus trapped, click backdrop to close
 * - Keyboard navigation with arrow keys
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   defaults?: {
 *     automation?: number;   // 0..1
 *     augmentation?: number; // 0..1
 *     manual?: number;       // 0..1 (derived if not provided)
 *   }
 */

interface Props {
  open: boolean;
  onClose: () => void;
  defaults?: {
    automation?: number;
    augmentation?: number;
    manual?: number;
  };
}

const QUESTION_1 = "People talk \"AI mass replacement\" - but... where is it?";
const QUESTION_2 = "If it's here, what does it mean for my role, my team, my company?";
const QUESTION_3 = "What industries and countries should I look to - who wins, who loses?";

export default function HelpMeUnderstandModal({
  open,
  onClose,
  defaults,
}: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showDelayedIntro, setShowDelayedIntro] = useState(false);
  const isMobile = useIsMobile();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    skipSnaps: false,
    dragFree: false,
  });

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
    { title: "Try It Yourself", subtitle: "Jump into your company or region" },
    { title: "Reality Check", subtitle: "What AI replacement actually looks like" },
    // { title: "Organizational View", subtitle: "Applying insights across your company" },
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

  const handleJumpToHero = useCallback(() => {
    onClose();
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const heroInput = document.querySelector<HTMLInputElement>('input[aria-label="Company name"]');
      if (heroInput) {
        heroInput.focus({ preventScroll: true });
        heroInput.select();
      }
    }, 120);
  }, [onClose]);

  const handleJumpToComparative = useCallback(() => {
    onClose();
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      const comparativeSection = document.querySelector<HTMLElement>('[aria-labelledby="comparative-insights-heading"]');
      comparativeSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [onClose]);

  // Reset to first slide when modal opens
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  // Delayed fade-in for first slide subheading
  useEffect(() => {
    if (!open || currentSlide !== 0) {
      setShowDelayedIntro(false);
      return;
    }
    const t = window.setTimeout(() => setShowDelayedIntro(true), 3000);
    return () => window.clearTimeout(t);
  }, [open, currentSlide]);

  // Sync mobile carousel state with Embla
  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    const onSelect = () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, isMobile]);

  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    emblaApi.scrollTo(currentSlide, true);
  }, [currentSlide, emblaApi, isMobile]);

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

  const slideSections = useMemo(
    () => [
      (
        <section
          aria-label="Three questions"
          className="flex h-full flex-col items-center justify-center gap-6 px-3 py-8 text-center md:px-0 md:py-0"
        >
          <div className="w-full max-w-2xl space-y-6">
            <h3 className="text-3xl font-medium leading-tight text-neutral-800 md:text-4xl">
              Let me ask you
            </h3>
            <h3 className="text-lg font-medium leading-tight text-neutral-800 md:text-xl">
              some questions I've been stuck on
            </h3>
            <div className="space-y-4">
              <HookCard title={QUESTION_1} />
              <HookCard title={QUESTION_2} />
              <HookCard title={QUESTION_3} />
            </div>
            <h3
              className={cn(
                "text-base font-medium text-neutral-800 transition-opacity duration-700 md:text-lg",
                showDelayedIntro ? "opacity-100" : "opacity-0"
              )}
            >
              This project is exploring some early answers
            </h3>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Breaking down workforce"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl">
            <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
              To figure these out, we need to break down what is a workforce?
            </h3>
            <div
              className="w-full overflow-hidden rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <WorkforceBreakdownDiagram />
            </div>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Breaking down roles to tasks"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl">
            <h3 className="mb-4 text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
              And we need to break down roles into individual tasks
            </h3>
            <div
              className="w-full overflow-hidden rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <RoleToTasksDiagram />
            </div>
          </div>
        </section>
      ),
      (
        <section
          aria-label="AI usage detection"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl space-y-6">
            <h3 className="text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
              Which lets us identify if{" "}
              <DefinitionHover
                accent="#f59e60"
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
            <div
              className="w-full overflow-hidden rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <AIUsageDiagram />
            </div>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Task classification"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl space-y-6">
            <h3 className="text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
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
            <div
              className="w-full overflow-hidden rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <TaskClassificationDiagram />
            </div>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Role impact"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl space-y-6">
            <h3 className="text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
              Giving us an overview of the impact on any role
            </h3>
            <div
              className="w-full overflow-hidden rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <RoleImpactDiagram />
            </div>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Org research and headcount estimation"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl md:max-w-5xl space-y-6">
            <h3 className="text-2xl font-semibold text-center text-neutral-800 md:text-3xl">
              Which we project onto teams and companies by using AI to{" "}
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
      ),
      (
        <section
          aria-label="Org to economy benchmarking"
          className="flex h-full flex-col justify-start gap-6 px-3 py-8 md:items-center md:justify-center md:px-4 md:py-6"
        >
          <div className="mx-auto w-full max-w-3xl space-y-6 text-center text-neutral-800 md:max-w-5xl">
            <h3 className="text-2xl font-semibold md:text-3xl">
              Then we benchmark exposure across peers, sectors, and countries
            </h3>
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(34,28,20,0.08)" }}
            >
              <MiniFlow />
              <div className="mt-4 grid gap-3 text-sm text-neutral-800 md:grid-cols-3">
                <TinyStat label="Peer benchmarking" value="1,000+ firms" hint="public runs & research set" />
                <TinyStat label="Sector rollups" value="40+ industries" hint="industry comparisons" />
                <TinyStat label="Country slices" value="50+ countries" hint="policy targeting" />
              </div>
            </div>
            <p className="mx-auto max-w-3xl text-sm text-neutral-700 md:text-base">
              Exposure scores stay tied back to the task evidence beneath them, so readers can explore the chain from company to county.
            </p>
          </div>
        </section>
      ),
      (
        <section
          aria-label="Try it yourself"
          className="flex h-full flex-col justify-center gap-8 px-4 py-8 text-left text-neutral-800 md:items-center md:py-6"
        >
          <div className="mx-auto w-full max-w-xl space-y-6 md:text-center">
            <h3 className="text-xl font-semibold text-neutral-900 md:text-2xl">
              Ready to see what this means for your company and teams?
            </h3>
            <p className="text-base text-neutral-700 md:text-lg">
              Start by{" "}
              <button
                type="button"
                onClick={handleJumpToHero}
                className="inline-flex items-center gap-1 font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4 transition hover:text-neutral-700"
              >
                running your own company analysis
              </button>{" "}
              or seeing how{" "}
              <button
                type="button"
                onClick={handleJumpToComparative}
                className="inline-flex items-center gap-1 font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4 transition hover:text-neutral-700"
              >
                your sector or country is shifting
              </button>
              .
            </p>
            <p className="text-base text-neutral-700 md:text-lg">
              Want my quick read on those three original questions before you poke around?{" "}
              <button
                type="button"
                onClick={goToNextSlide}
                className="inline-flex items-center gap-1 font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4 transition hover:text-neutral-700"
              >
                Show me →
              </button>
            </p>
          </div>
        </section>
      ),
      (
        <section
          aria-label="AI replacement reality check"
          className="flex h-full flex-col justify-start px-2 py-6 md:items-center md:justify-center md:px-4 md:py-8"
        >
          <div className="mx-auto w-full max-w-5xl">
            <RealityCheckSlide />
          </div>
        </section>
      ),
    ],
    [goToNextSlide, handleJumpToComparative, handleJumpToHero, showDelayedIntro]
  );

  if (!open) return null;

  const container = typeof document !== "undefined" ? document.body : null;
  if (!container) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[1000] flex items-center justify-center",
        isMobile && "items-center"
      )}
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
        className={cn(
          "mx-4 w-full max-w-3xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] outline-none",
          isMobile && "mx-2 h-[calc(100vh-6rem)] max-w-none overflow-hidden rounded-[28px]"
        )}
        style={{
          background:
            "linear-gradient(155deg, rgba(246,245,241,0.95), rgba(237,235,229,0.92))",
          border: "1px solid rgba(34,28,20,0.10)",
        }}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between gap-4 border-b border-neutral-200/50 px-6 pb-4 pt-5",
            isMobile && "px-4 pb-0 pt-4"
          )}
        >
          <div>
            {/* <h2 id={titleId} className="text-lg font-medium tracking-tight text-neutral-600">
              Help me understand
            </h2> */}
          </div>
          <button
            onClick={onClose}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200/60 focus:outline-none focus:ring-2 focus:ring-black/20",
              isMobile && "h-10 w-10 rounded-full px-0 py-0 text-base"
            )}
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Progress Indicators */}
        {!isMobile && (
          <div className="px-6 pt-0 -mt-12 pb-2">
            <div className="flex items-center justify-center gap-2">
              {slides.map((slide, i) => (
                <div key={i} className="group relative">
                  <button
                    onClick={() => goToSlide(i)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === currentSlide ? "w-8 bg-neutral-900" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    )}
                    aria-label={`Go to ${slide.title}`}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-white">
                      {slide.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isMobile ? (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
              <div ref={emblaRef} className="h-full w-full overflow-hidden">
                <div className="flex h-full">
                  {slideSections.map((section, index) => (
                    <div
                      key={index}
                      className="flex h-full min-w-0 flex-shrink-0 basis-full flex-col overflow-y-auto px-4 pb-0 pt-0"
                    >
                      {section}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200/70 bg-white/70 px-4 py-4 pb-18 shadow-[0_-8px_24px_rgba(31,25,15,0.02)] backdrop-blur">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                <span>{slides[currentSlide]?.title}</span>
                <span>
                  {currentSlide + 1} / {totalSlides}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goToPrevSlide}
                  disabled={currentSlide === 0}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center rounded-full text-sm font-medium transition",
                    currentSlide === 0
                      ? "cursor-not-allowed bg-neutral-200/70 text-neutral-400"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                  )}
                >
                  Back
                </button>
                <div className="flex items-center justify-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToSlide(i)}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === currentSlide ? "w-6 bg-neutral-900" : "w-2 bg-neutral-300"
                      )}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={goToNextSlide}
                  disabled={currentSlide === totalSlides - 1}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center rounded-full text-sm font-medium transition",
                    currentSlide === totalSlides - 1
                      ? "cursor-not-allowed bg-neutral-200/70 text-neutral-400"
                      : "bg-[#e87038] text-white hover:bg-[#e04800]"
                  )}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 pb-4 overflow-hidden min-h-[400px] md:min-h-[480px]">
              <div
                className="transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                <div className="flex min-h-[380px] md:min-h-[460px]">
                  {slideSections.map((section, index) => (
                    <div key={index} className="w-full flex-shrink-0 px-1">
                      {section}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-200/50 px-6 pb-5 pt-2">
              <button
                onClick={goToPrevSlide}
                disabled={currentSlide === 0}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-black/20",
                  currentSlide === 0
                    ? "cursor-not-allowed text-neutral-400"
                    : "text-neutral-700 hover:bg-neutral-200/60"
                )}
                aria-label="Previous slide"
              >
                <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs">←</kbd> Previous
              </button>

              <button
                onClick={goToNextSlide}
                disabled={currentSlide === totalSlides - 1}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-black/20",
                  currentSlide === totalSlides - 1
                    ? "cursor-not-allowed text-neutral-400"
                    : "text-neutral-700 hover:bg-neutral-200/60"
                )}
                aria-label="Next slide"
              >
                Next <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs">→</kbd>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    container
  );
}

/* ---------- Subcomponents ---------- */



function HookCard({ title }: { title: string }) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:shadow-md"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.15))",
        border: "1px solid rgba(34,28,20,0.08)",
      }}
    >
      <p className="text-lg font-medium text-neutral-900">{title}</p>
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



function TinyStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-300/60 bg-white/70 p-2">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
      {hint && <div className="text-xs text-neutral-600">{hint}</div>}
    </div>
  );
}


/* ---------- Helpers ---------- */


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
      <button
        onClick={() => setOnboardingOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm ring-1 ring-black/5 transition-all hover:bg-white/60"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
          <path d="M12 8v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Help me understand
      </button>
      <HelpMeUnderstandModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        defaults={{ automation: 0.30, augmentation: 0.55 }}
      />
    </>
  );
};
