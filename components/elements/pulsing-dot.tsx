import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type PulsingDotProps = HTMLAttributes<HTMLSpanElement>;

export const PulsingDot = ({ className, ...props }: PulsingDotProps) => (
  <span
    aria-hidden
    className={cn(
      "block size-2 animate-pulse rounded-full bg-[#26251e]",
      className,
    )}
    {...props}
  />
);
