"use client";
import { cn } from "@/lib/utils";
import { useMemo, memo, useLayoutEffect } from "react";

export type TextShimmerProps = {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
};

const styleId = "ai-agent-shimmer-keyframes";

function TextShimmerComponent({ children, className, duration = 2, spread = 2 }: TextShimmerProps) {
  useLayoutEffect(() => {
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `@keyframes shimmer { from { background-position: 100% center; } to { background-position: 0% center; } } .shimmer-text { animation: shimmer var(--duration, 2s) linear infinite; }`;
    document.head.appendChild(style);
  }, []);

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <p
      className={cn(
        "shimmer-text",
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text",
        "[-webkit-text-fill-color:transparent]",
        "text-transparent [--base-color:#a1a1aa] [--base-gradient-color:#000]",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]",
        // Comment out until we have proper dark mode support
        // "dark:[--base-color:#71717a] dark:[--base-gradient-color:#ffffff] dark:[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]",
        className,
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          "--duration": `${duration}s`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
    >
      {children}
    </p>
  );
}

export const TextShimmer = memo(TextShimmerComponent);
