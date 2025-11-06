"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { cn, slugifyCompanyName } from "@/lib/utils";
import { useAutoWidthInput } from "./useAutoWidthInput";
import { ApiKeyInput } from "./api-key-input";


interface HeroProps {
  initialValue?: string;
  remainingRuns?: number | null;
}

const MAX_LENGTH = 50;
const TYPEWRITER_TEXT = "Big Company";
const TYPE_DELAY = 120;
const ERASE_DELAY = 70;
const HOLD_DELAY = 1400;

export function Hero({ initialValue = "", remainingRuns }: HeroProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const [isTypewriterActive, setIsTypewriterActive] = useState(() => initialValue.length === 0);
  const [typewriterDirection, setTypewriterDirection] = useState<1 | -1>(1);
  const typewriterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setValue(initialValue);
    if (initialValue.length > 0) {
      setHasUserInteracted(true);
      hasUserInteractedRef.current = true;
      setIsTypewriterActive(false);
    }
  }, [initialValue]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (!hasUserInteractedRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }
  }, [hasUserInteracted]);

  useEffect(() => {
    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTypewriterActive) {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
        typewriterTimeoutRef.current = null;
      }
      return;
    }

    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
    }

    const target = TYPEWRITER_TEXT;

    if (typewriterDirection === 1 && value === target) {
      typewriterTimeoutRef.current = setTimeout(() => {
        setTypewriterDirection(-1);
      }, HOLD_DELAY);
      return;
    }

    if (typewriterDirection === -1 && value.length === 0) {
      typewriterTimeoutRef.current = setTimeout(() => {
        setTypewriterDirection(1);
      }, HOLD_DELAY);
      return;
    }

    const delay = typewriterDirection === 1 ? TYPE_DELAY : ERASE_DELAY;
    typewriterTimeoutRef.current = setTimeout(() => {
      const nextLength = Math.max(
        0,
        Math.min(target.length, value.length + typewriterDirection)
      );
      const nextValue = target.slice(0, nextLength);
      setValue(nextValue);
    }, delay);
  }, [isTypewriterActive, typewriterDirection, value]);

  const isBudgetExhausted = remainingRuns != null && remainingRuns <= 0;
  const companyInputDisabled = isBudgetExhausted && !apiKey;

  const helperText = (() => {
    if (remainingRuns == null) return "";
    if (remainingRuns <= 0) return "Budget exhausted";
    if (remainingRuns === 1) return " public run left";
    return ` public runs remaining`;
  })();

  const updateValue = (next: string) => {
    const sanitized = next.replace(/\s+/g, " ").slice(0, MAX_LENGTH);
    setValue(sanitized);
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError("Max 50 characters");
      return;
    }
    if (isBudgetExhausted && !apiKey) {
      setError("Budget exhausted");
      return;
    }

    setError(null);
    const slug = slugifyCompanyName(trimmed);
    const params = new URLSearchParams({ name: trimmed });
    if (apiKey) {
      params.set("apiKey", apiKey);
    }
    router.push(`/run/${slug}?${params.toString()}`);
  };

  const hasTypedValue = hasUserInteracted ? value.trim().length > 0 : false;
  // const dynamicWidth = `${Math.max(hasValue ? value.length + 1 : 3, 3)}ch`;
  const { ref: autoRef, width: autoWidth } = useAutoWidthInput<HTMLInputElement>({
    value,
    placeholder: "...",   // match your input placeholder
    minCh: 3,             // same behavior you had
    padEndSpaces: 1,      // room for the caret
    includeInputPadding: true,
    extraPx: 0,
  }, inputRef);
  const inputResponsiveStyle = {
    "--hero-input-width": autoWidth,
  } as CSSProperties;

  return (
    <div
      id="landing-hero"
      data-hero-root
      className="relative overflow-hidden rounded-[24px] border border-[rgba(38,37,30,0.1)] p-8 shadow-[0_28px_60px_rgba(31,25,15,0.12)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:p-12"
      style={{
        backgroundImage: "linear-gradient(135deg, rgba(242,241,237,0.98), rgba(233,231,225,0.94))",
      }}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,184,138,0.35),_rgba(255,248,240,0))]" />
      <div className="absolute -right-16 top-16 -z-10 h-60 w-60 rounded-full bg-[rgba(245,78,0,0.15)] blur-[140px]" />
      <div className="absolute -left-20 bottom-10 -z-10 h-60 w-60 rounded-full bg-[rgba(49,138,101,0.1)] blur-[130px]" />

      <div className="space-y-6">
        <div className="flex flex-row items-center justify-between gap-2">

          <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
            Workforce Intelligence
          </p>
          <OnboardingTrigger />
        </div>
        <div className="text-balance text-[clamp(32px,7vw,64px)] leading-[1.05] text-[#26251e] sm:text-[clamp(42px,5vw,64px)]">
          <span className="font-light text-[#1f1d16]/85 max-sm:block">
            What AI impact is
          </span>
          <input
            ref={autoRef}
            type="text"
            inputMode="text"
            value={value}
            onFocus={() => {
              if (!hasUserInteractedRef.current) {
                requestAnimationFrame(() => inputRef.current?.select());
              }
            }}
            onChange={(event) => {
              const incoming = event.target.value;
              if (!hasUserInteractedRef.current) {
                hasUserInteractedRef.current = true;
                setHasUserInteracted(true);
                setIsTypewriterActive(false);
                if (lastKeyRef.current === "Backspace" || lastKeyRef.current === "Delete") {
                  updateValue("");
                } else {
                  const nextChar = incoming.slice(-1);
                  updateValue(nextChar);
                }
                lastKeyRef.current = null;
                return;
              }
              updateValue(incoming);
              lastKeyRef.current = null;
            }}
            onPaste={(event) => {
              hasUserInteractedRef.current = true;
              setHasUserInteracted(true);
              setIsTypewriterActive(false);
              event.preventDefault();
              updateValue(event.clipboardData.getData("text"));
              lastKeyRef.current = null;
            }}
            onKeyDown={(event) => {
              const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
              const isEditingKey = isPrintable || event.key === "Backspace" || event.key === "Delete";

              if (!hasUserInteractedRef.current && isEditingKey) {
                setHasUserInteracted(true);
                setIsTypewriterActive(false);
                setTypewriterDirection(1);
                setValue("");
                lastKeyRef.current = event.key;
              } else if (isEditingKey) {
                lastKeyRef.current = event.key;
              } else {
                lastKeyRef.current = null;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            maxLength={MAX_LENGTH}
            placeholder="..."
            aria-label="Company name"
            disabled={companyInputDisabled}
            autoComplete="off"
            className={cn(
              "relative inline-flex items-center rounded-md border-b border-[rgba(245,78,0,0.2)] bg-transparent px-2 py-0 text-[#f54e00cc] outline-none transition focus:border-[#f54e00] focus:shadow-[0_0_0_6px_rgba(245,78,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60",
              "placeholder:text-[#f54e00]/75 placeholder:tracking-widest placeholder:font-light",
              "text-[clamp(32px,7vw,64px)] font-semibold sm:text-[clamp(42px,5vw,64px)]",
              "duration-150 ease-out",
              "max-sm:mt-3 max-sm:w-full sm:ml-4 sm:min-w-[8ch] sm:[width:var(--hero-input-width)]"
            )}
            style={inputResponsiveStyle}
          />
          <span className="block font-light text-[#1f1d16]/85 mt-3 sm:mt-4">
            likely seeing across their workforce?
          </span>
        </div>

        <div className="relative flex items-center gap-3 mt-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(38,37,30,0.08)] to-transparent" />
        </div>

        <ApiKeyInput disabled={isBudgetExhausted} onApiKeyChange={setApiKey} />

        <div className="mt-6 flex items-center justify-between gap-4 transition-all duration-200 ease-out">
          <Button
            onClick={handleSubmit}
            disabled={(isBudgetExhausted && !apiKey) || !hasTypedValue}
            className={cn(
              "h-10 lg:h-12 rounded-full px-5 lg:px-7 text-xs font-semibold uppercase tracking-[0.24em] transition",
              hasTypedValue && (!isBudgetExhausted || apiKey)
                ? "cursor-pointer bg-[linear-gradient(120deg,#f54e00,#ff9440)] text-white shadow-[0_20px_45px_rgba(245,78,0,0.35)] hover:shadow-[0_26px_60px_rgba(245,78,0,0.45)]"
                : "cursor-default bg-[rgba(38,37,30,0.08)] text-[rgba(38,37,30,0.45)] shadow-none"
            )}
          >
            Launch run
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <span className="text-[10px] lg:text-xs uppercase tracking-[0.28em] text-[#49463c]/80">
            {error ? (
              <span className="font-mono text-[#cf2d56]">{error}</span>
            ) : remainingRuns != null ? (
              <span className="inline-flex items-center gap-3 font-mono">
                <span className="inline-flex items-center justify-center rounded-xl bg-[rgba(95,121,82,0.18)] px-3 py-1 text-xs lg:text-sm font-mono tabular-nums text-[#2f3f29]">
                  {Math.max(remainingRuns, 0).toString().padStart(2, "0")}
                </span>
                <span>{helperText.toUpperCase()}</span>
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}
