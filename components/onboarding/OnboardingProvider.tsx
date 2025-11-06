"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import HelpMeUnderstandModal from "./Onboarding";

type OnboardingContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <HelpMeUnderstandModal
        open={isOpen}
        onClose={close}
        defaults={{ automation: 0.30, augmentation: 0.55 }}
      />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}


