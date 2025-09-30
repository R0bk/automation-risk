"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

import { useTaskMixView } from "./task-mix-view-context";
import type { TaskMixView } from "@/lib/run/task-mix";

const OPTIONS: Array<{ value: TaskMixView; label: string; description: string }> = [
  {
    value: "coverage",
    label: "Task coverage",
    description: "Shows how many tasks fall into automation, augmentation, or manual buckets.",
  },
  {
    value: "usage",
    label: "Usage intensity",
    description: "Shows Anthropic-weighted usage across automation and augmentation modes.",
  },
];

export function TaskMixSelector() {
  const { view, setView } = useTaskMixView();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const activeOption = OPTIONS.find((option) => option.value === view) ?? OPTIONS[0];

  return (
    <div ref={containerRef} className="relative select-none text-right">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[rgba(38,37,30,0.6)] hover:text-[#26251e]"
      >
        <span className="border-b border-current pb-0.5">{activeOption.label}</span>
        <ChevronDown size={12} className="text-[rgba(38,37,30,0.6)]" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[220px] overflow-hidden rounded-xl border border-[rgba(38,37,30,0.12)] bg-white text-left shadow-[0_22px_46px_rgba(34,28,20,0.18)]">
          {OPTIONS.map((option) => {
            const isActive = option.value === view;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setView(option.value);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full px-4 py-3 text-left text-[11px] leading-[1.4]",
                  isActive
                    ? "bg-[rgba(38,37,30,0.08)] text-[#26251e]"
                    : "text-[rgba(38,37,30,0.65)] hover:bg-[rgba(38,37,30,0.05)]",
                )}
              >
                <div className="font-semibold uppercase tracking-[0.24em]">{option.label}</div>
                <div className="mt-1 text-[10px] normal-case tracking-normal text-[rgba(38,37,30,0.55)]">
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
