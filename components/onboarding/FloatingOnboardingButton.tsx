"use client";

import { useEffect, useState } from "react";
import { useOnboarding } from "./OnboardingProvider";
import { cn } from "@/lib/utils";

function useHeroIsOutOfView() {
  const [isOutOfView, setIsOutOfView] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const initObserver = () => {
      if (cancelled) return;
      const heroElement = document.querySelector<HTMLElement>("[data-hero-root]");
      if (!heroElement) {
        requestAnimationFrame(initObserver);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsOutOfView(!entry.isIntersecting);
        },
        {
          root: null,
          threshold: 0,
          rootMargin: "-96px 0px 0px 0px",
        }
      );

      observer.observe(heroElement);
    };

    initObserver();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return isOutOfView;
}

export function FloatingOnboardingButton() {
  const { open, isOpen } = useOnboarding();
  const heroScrolledPast = useHeroIsOutOfView();

  const show = heroScrolledPast && !isOpen;

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "fixed bottom-5 right-5 z-[1050] flex items-center gap-2 rounded-full bg-[#26251e] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_18px_40px_rgba(38,37,30,0.35)] transition-all duration-200 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#26251e]",
        show
          ? "pointer-events-auto opacity-100 translate-y-0"
          : "pointer-events-none opacity-0 translate-y-3"
      )}
      aria-label="Help me understand"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="opacity-85">
        <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
        <path d="M12 8v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Help me understand
    </button>
  );
}
