"use client";
import { useOnboarding } from "./OnboardingProvider";

export function OnboardingTrigger() {
  const { open } = useOnboarding();
  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-xs lg:text-sm ring-1 ring-black/5 hover:bg-white/60 transition-all"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
        <path d="M12 8v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Help me understand
    </button>
  );
}


