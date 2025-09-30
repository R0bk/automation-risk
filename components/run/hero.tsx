"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, slugifyCompanyName } from "@/lib/utils";
import { useAutoWidthInput } from "./useAutoWidthInput";

interface HeroProps {
  initialValue?: string;
  remainingRuns?: number | null;
}

const MAX_LENGTH = 50;

export function Hero({ initialValue = "", remainingRuns }: HeroProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, []);

  const disabled = remainingRuns != null && remainingRuns <= 0;

  const helperText = (() => {
    if (remainingRuns == null) return "";
    if (remainingRuns <= 0) return "Budget exhausted";
    if (remainingRuns === 1) return " public run left";
    return ` public runs remaining`;
  })();

  const updateValue = (next: string) => {
    const sanitized = next.replace(/\s+/g, " ").slice(0, MAX_LENGTH);
    setValue(sanitized);
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
    if (disabled) {
      setError("Budget exhausted");
      return;
    }

    setError(null);
    const slug = slugifyCompanyName(trimmed);
    router.push(`/run/${slug}?name=${encodeURIComponent(trimmed)}`);
  };

  const hasValue = value.trim().length > 0;
  // const dynamicWidth = `${Math.max(hasValue ? value.length + 1 : 3, 3)}ch`;
  const { ref: autoRef, style: autoWidthStyle } = useAutoWidthInput<HTMLInputElement>({
    value,
    placeholder: "...",   // match your input placeholder
    minCh: 3,             // same behavior you had
    padEndSpaces: 1,      // room for the caret
    includeInputPadding: true,
    extraPx: 0,
  }, inputRef);

  return (
    <div
      className="relative overflow-hidden rounded-[24px] border border-[rgba(38,37,30,0.1)] p-8 shadow-[0_28px_60px_rgba(31,25,15,0.12)] backdrop-blur-[14px] sm:p-12"
      style={{
        backgroundImage: "linear-gradient(135deg, rgba(242,241,237,0.98), rgba(233,231,225,0.94))",
      }}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,184,138,0.35),_rgba(255,248,240,0))]" />
      <div className="absolute -right-16 top-16 -z-10 h-60 w-60 rounded-full bg-[rgba(245,78,0,0.15)] blur-[140px]" />
      <div className="absolute -left-20 bottom-10 -z-10 h-60 w-60 rounded-full bg-[rgba(49,138,101,0.1)] blur-[130px]" />

      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
          Workforce Intelligence
        </p>
        <div className="text-balance text-[clamp(42px,5vw,64px)] leading-[1.05] text-[#26251e]">
          <span className="font-light text-[#1f1d16]/85">
            What is the AI impact at
          </span>
          <input
            ref={autoRef}
            type="text"
            inputMode="text"
            value={value}
            onChange={(event) => updateValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            maxLength={MAX_LENGTH}
            placeholder="..."
            aria-label="Company name"
            disabled={disabled}
            autoComplete="off"
            className={cn(
              "relative mx-2 ml-4 inline-flex items-center rounded-md border-b border-[rgba(245,78,0,0.2)] bg-transparent px-2 py-0 text-[#f54e00cc] outline-none transition focus:border-[#f54e00] focus:shadow-[0_0_0_6px_rgba(245,78,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60",
              "placeholder:text-[#f54e00]/75 placeholder:tracking-widest placeholder:font-light",
              "text-[clamp(42px,5vw,64px)] font-semibold",
              "duration-150 ease-out"
            )}
            style={autoWidthStyle}
          />
          <span className="ml-1 font-light text-[#1f1d16]/85">
            <br/>likely to be across their workforce?
          </span>
        </div>

        <div className="relative flex items-center gap-3 mt-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(38,37,30,0.08)] to-transparent" />
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 transition-all duration-200 ease-out">
          <Button
            onClick={handleSubmit}
            disabled={disabled || !hasValue}
            className={cn(
              "h-12 rounded-full px-7 text-xs font-semibold uppercase tracking-[0.24em] transition",
              hasValue && !disabled
                ? "cursor-pointer bg-[linear-gradient(120deg,#f54e00,#ff9440)] text-white shadow-[0_20px_45px_rgba(245,78,0,0.35)] hover:shadow-[0_26px_60px_rgba(245,78,0,0.45)]"
                : "cursor-default bg-[rgba(38,37,30,0.08)] text-[rgba(38,37,30,0.45)] shadow-none"
            )}
          >
            Launch run
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <span className="text-xs uppercase tracking-[0.28em] text-[#49463c]/80">
            {error ? (
              <span className="font-mono text-[#cf2d56]">{error}</span>
            ) : remainingRuns != null ? (
              <span className="inline-flex items-center gap-3 font-mono">
                <span className="inline-flex items-center justify-center rounded-xl bg-[rgba(95,121,82,0.18)] px-3 py-1 text-sm font-mono tabular-nums text-[#2f3f29]">
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
